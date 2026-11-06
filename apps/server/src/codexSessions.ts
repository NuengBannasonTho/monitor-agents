import { open, readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AgentEvent } from '@agent-office/shared';
import { safeLabel } from './summarize.js';
import type { AgentStore } from './store.js';

/** Codex writes these local rollouts while a turn runs. Reading them never calls a model. */
const POLL_MS = 2_000;
const RECENT_MS = 30 * 60_000;

type RecordValue = Record<string, unknown>;
interface Session {
  id: string;
  cwd: string;
}

function object(value: unknown): RecordValue | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function eventAt(value: unknown): number {
  const date = Date.parse(text(value) ?? '');
  return Number.isFinite(date) ? date : Date.now();
}

/** Turn status and completed tool names only: prompts, replies and tool output stay on disk. */
export function codexRolloutEvent(
  raw: unknown,
  session: Session | null,
): {
  session: Session | null;
  event: AgentEvent | null;
} {
  const line = object(raw);
  if (line === null) return { session, event: null };
  const payload = object(line.payload);
  if (line.type === 'session_meta' && payload !== null) {
    const id = text(payload.id) ?? text(payload.session_id);
    const cwd = text(payload.cwd);
    if (id === null || cwd === null || !path.isAbsolute(cwd))
      return { session, event: null };
    const next = { id: `codex:${id}`, cwd };
    return {
      session: next,
      event: {
        sessionId: next.id,
        kind: 'codex',
        cwd,
        type: 'start',
        at: eventAt(line.timestamp),
        summary: 'Codex session started',
      },
    };
  }
  if (line.type !== 'event_msg' || payload === null || session === null) {
    return { session, event: null };
  }
  const base = {
    sessionId: session.id,
    kind: 'codex' as const,
    cwd: session.cwd,
    at: eventAt(line.timestamp),
  };
  if (payload.type === 'task_started') {
    return {
      session,
      event: { ...base, type: 'prompt', summary: 'Codex turn started' },
    };
  }
  if (payload.type === 'task_complete') {
    return {
      session,
      event: { ...base, type: 'stop', summary: 'Codex turn finished' },
    };
  }
  if (payload.type === 'turn_aborted') {
    return {
      session,
      event: { ...base, type: 'interrupt', summary: 'Codex turn interrupted' },
    };
  }
  if (payload.type === 'item_completed') {
    const item = object(payload.item);
    if (item?.type === 'CommandExecution') {
      const command = text(item.command);
      return {
        session,
        event: {
          ...base,
          type: 'tool',
          toolName: 'Codex',
          summary:
            command === null
              ? 'Command finished'
              : `Command finished: ${safeLabel(command, 80)}`,
        },
      };
    }
    if (item?.type === 'McpToolCall') {
      const name = text(item.tool) ?? 'MCP tool';
      return {
        session,
        event: {
          ...base,
          type: 'tool',
          toolName: name,
          summary: `${safeLabel(name, 60)} finished`,
        },
      };
    }
  }
  return { session, event: null };
}

async function roots(): Promise<string[]> {
  const home = os.homedir();
  const list = new Set([process.env.CODEX_HOME ?? path.join(home, '.codex')]);
  const accounts = path.join(
    home,
    'Library/Application Support/orca/codex-accounts',
  );
  for (const account of await readdir(accounts, { withFileTypes: true }).catch(
    () => [],
  )) {
    if (account.isDirectory())
      list.add(path.join(accounts, account.name, 'home'));
  }
  return [...list];
}

async function recentFiles(now: number): Promise<string[]> {
  const days = [new Date(now), new Date(now - 86_400_000)];
  const files: string[] = [];
  for (const root of await roots()) {
    for (const day of days) {
      const dir = path.join(
        root,
        'sessions',
        String(day.getFullYear()),
        String(day.getMonth() + 1).padStart(2, '0'),
        String(day.getDate()).padStart(2, '0'),
      );
      for (const entry of await readdir(dir, { withFileTypes: true }).catch(
        () => [],
      )) {
        if (entry.isFile() && entry.name.endsWith('.jsonl'))
          files.push(path.join(dir, entry.name));
      }
    }
  }
  return files;
}

interface Cursor {
  size: number;
  pending: string;
  session: Session | null;
}

/** Poll only files touched recently; a cursor prevents replaying a whole conversation. */
export function startCodexSessions(store: AgentStore): () => void {
  const cursors = new Map<string, Cursor>();
  let busy = false;
  let stopped = false;
  const poll = async (): Promise<void> => {
    if (busy || stopped) return;
    busy = true;
    try {
      const now = Date.now();
      for (const file of await recentFiles(now)) {
        const info = await stat(file).catch(() => null);
        if (info === null || now - info.mtimeMs > RECENT_MS) continue;
        const prior = cursors.get(file);
        const cursor: Cursor =
          prior === undefined || info.size < prior.size
            ? { size: 0, pending: '', session: null }
            : prior;
        if (info.size === cursor.size) continue;
        const handle = await open(file, 'r').catch(() => null);
        if (handle === null) continue;
        try {
          const length = Math.min(info.size - cursor.size, 1024 * 1024);
          const bytes = Buffer.alloc(length);
          const { bytesRead } = await handle.read(
            bytes,
            0,
            length,
            cursor.size,
          );
          cursor.size += bytesRead;
          const lines = (
            cursor.pending + bytes.subarray(0, bytesRead).toString('utf8')
          ).split('\n');
          cursor.pending = lines.pop() ?? '';
          for (const line of lines) {
            try {
              const result = codexRolloutEvent(
                JSON.parse(line),
                cursor.session,
              );
              cursor.session = result.session;
              if (result.event !== null) {
                store.apply(result.event);
                if (result.event.type === 'tool') {
                  store.apply({
                    ...result.event,
                    type: 'tool-end',
                    summary: undefined,
                  });
                }
              }
            } catch {
              // A partial or unfamiliar rollout line must not affect the dashboard.
            }
          }
          cursors.set(file, cursor);
        } finally {
          await handle.close();
        }
      }
    } finally {
      busy = false;
    }
  };
  void poll();
  const timer = setInterval(() => {
    void poll();
  }, POLL_MS);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
