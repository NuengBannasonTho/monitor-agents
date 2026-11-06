import type { Dirent } from 'node:fs';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { UsageRange, UsageReport } from '@agent-office/shared';
import { buildReport } from './report.js';
import type { ParseContext, TranscriptFile } from './transcripts.js';
import { newTranscriptFile, parseLine, readLines } from './transcripts.js';

/*
 * Keeps every recent transcript read and up to date: the first report reads them all, later
 * ones only what was appended since (transcripts only grow). Files untouched for longer than
 * the longest range are never opened.
 */

const DAY_MS = 86_400_000;
/** The longest range (30 days), and a day to spare. */
const MAX_AGE_MS = 31 * DAY_MS;
/** Reports asked for in quick succession share one look at the disk. */
const MIN_REFRESH_MS = 4_000;

/**
 * Where Claude Code keeps transcripts: $CLAUDE_CONFIG_DIR/projects, ~/.claude/projects, and
 * each Claude profile Orca runs agents with (often links to the same folder).
 */
export function defaultTranscriptRoots(
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
): () => Promise<string[]> {
  return async () => {
    const candidates = [path.join(home, '.claude', 'projects')];
    const config = env.CLAUDE_CONFIG_DIR;
    if (config !== undefined && config !== '') candidates.push(path.join(config, 'projects'));
    const orcaProfiles = path.join(
      home,
      'Library',
      'Application Support',
      'orca',
      'claude-profiles',
    );
    for (const profile of await safeReaddir(orcaProfiles)) {
      if (profile.isDirectory()) {
        candidates.push(path.join(orcaProfiles, profile.name, 'home', 'projects'));
      }
    }
    const roots = new Set<string>();
    for (const candidate of candidates) {
      try {
        roots.add(await realpath(candidate));
      } catch {
        // Not there.
      }
    }
    return [...roots];
  };
}

async function safeReaddir(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

interface Found {
  readonly path: string;
  readonly sessionId: string;
  readonly subagent: boolean;
}

/** <root>/<project>/<session>.jsonl and <root>/<project>/<session>/subagents/agent-*.jsonl. */
async function findTranscripts(root: string): Promise<Found[]> {
  const found: Found[] = [];
  for (const project of await safeReaddir(root)) {
    if (!project.isDirectory()) continue;
    const projectDir = path.join(root, project.name);
    for (const entry of await safeReaddir(projectDir)) {
      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        found.push({
          path: path.join(projectDir, entry.name),
          sessionId: entry.name.slice(0, -'.jsonl'.length),
          subagent: false,
        });
      } else if (entry.isDirectory()) {
        const subDir = path.join(projectDir, entry.name, 'subagents');
        for (const sub of await safeReaddir(subDir)) {
          if (sub.isFile() && sub.name.startsWith('agent-') && sub.name.endsWith('.jsonl')) {
            found.push({
              path: path.join(subDir, sub.name),
              sessionId: entry.name,
              subagent: true,
            });
          }
        }
      }
    }
  }
  return found;
}

/** agent-<id>.meta.json beside a subagent's transcript says what kind it is. */
async function subagentType(transcript: string): Promise<string | null> {
  try {
    const meta = JSON.parse(
      await readFile(transcript.replace(/\.jsonl$/, '.meta.json'), 'utf8'),
    ) as unknown;
    if (typeof meta === 'object' && meta !== null && 'agentType' in meta) {
      const type = meta.agentType;
      return typeof type === 'string' && type !== '' ? type.slice(0, 80) : null;
    }
  } catch {
    // No meta file (older Claude Code): the kind stays unknown.
  }
  return null;
}

export interface UsageIndexOptions {
  readonly roots: () => Promise<readonly string[]>;
  readonly now?: () => number;
}

export class UsageIndex {
  private readonly files = new Map<string, TranscriptFile>();
  private ctx: ParseContext = { requests: new Map(), toolUses: new Set() };
  private refreshing: Promise<void> | null = null;
  private refreshedAt = 0;
  private available = false;
  private readonly now: () => number;

  constructor(private readonly options: UsageIndexOptions) {
    this.now = options.now ?? Date.now;
  }

  async report(range: UsageRange): Promise<UsageReport> {
    await this.refresh();
    return buildReport(this.files.values(), range, this.now(), this.available);
  }

  /** Reads what changed on disk; concurrent callers wait for the same read. */
  refresh(): Promise<void> {
    if (this.refreshing !== null) return this.refreshing;
    if (this.now() - this.refreshedAt < MIN_REFRESH_MS) return Promise.resolve();
    this.refreshing = this.scan().finally(() => {
      this.refreshedAt = this.now();
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async scan(): Promise<void> {
    const roots = await this.options.roots();
    this.available = roots.length > 0;
    const oldest = this.now() - MAX_AGE_MS;
    for (const root of roots) {
      for (const found of await findTranscripts(root)) {
        let info;
        try {
          info = await stat(found.path);
        } catch {
          continue;
        }
        let file = this.files.get(found.path);
        if (file === undefined) {
          if (info.mtimeMs < oldest) continue;
          file = newTranscriptFile(found.path, found.sessionId, found.subagent);
          if (found.subagent) file.agentType = await subagentType(found.path);
          this.files.set(found.path, file);
        }
        if (info.size < file.offset) {
          // Rewritten from scratch (rare): start everything over.
          this.reset();
          return this.scan();
        }
        if (info.size === file.size && info.mtimeMs === file.mtimeMs) continue;
        file.mtimeMs = info.mtimeMs;
        file.size = info.size;
        const current = file;
        current.offset = await readLines(found.path, current.offset, info.size, (line) => {
          parseLine(current, line, this.ctx);
        });
      }
    }
  }

  private reset(): void {
    this.files.clear();
    this.ctx = { requests: new Map(), toolUses: new Set() };
    this.refreshedAt = 0;
  }
}
