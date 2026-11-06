import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { CustomAgent, CustomAgentInput, CustomAgentScope } from '@agent-office/shared';
import { Document, isMap, isSeq, parseDocument } from 'yaml';

/*
 * Claude Code subagents: Markdown files with YAML frontmatter, in ~/.claude/agents (yours)
 * and <project>/.claude/agents. Edits keep everything we do not edit (other keys, comments)
 * and refuse to write over a file that changed on disk since it was loaded.
 */

/** Folders deeper than this under an agents folder are not searched. */
const MAX_DEPTH = 3;
/** Most files listed per folder, and the biggest one read. */
const MAX_FILES = 300;
const MAX_FILE_BYTES = 512 * 1024;
const FRONTMATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n?---[ \t]*(?:\r?\n|$)/;

export class CustomAgentError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

/** Your agents folder: $CLAUDE_CONFIG_DIR/agents, else ~/.claude/agents. */
export function userAgentsDir(env: NodeJS.ProcessEnv = process.env): string {
  const config = env.CLAUDE_CONFIG_DIR;
  return path.join(
    config !== undefined && config !== '' ? config : path.join(os.homedir(), '.claude'),
    'agents',
  );
}

const exists = async (dir: string): Promise<boolean> => {
  try {
    return (await stat(dir)).isDirectory();
  } catch {
    return false;
  }
};

/**
 * Yours first, then one per folder an agent is working in (where Claude Code looks for the
 * project's agents). A project folder that is your home is the same as yours, so it is skipped.
 */
export async function agentScopes(
  userDir: string,
  projects: Iterable<string>,
): Promise<CustomAgentScope[]> {
  const scopes: CustomAgentScope[] = [
    { id: 'user', kind: 'user', label: 'Yours', dir: userDir, exists: await exists(userDir) },
  ];
  const seen = new Set([path.resolve(userDir)]);
  for (const project of [...new Set(projects)].sort()) {
    if (!path.isAbsolute(project) || !(await exists(project))) continue;
    const dir = path.join(project, '.claude', 'agents');
    if (seen.has(path.resolve(dir))) continue;
    seen.add(path.resolve(dir));
    scopes.push({
      id: `project:${project}`,
      kind: 'project',
      label: path.basename(project),
      dir,
      exists: await exists(dir),
    });
  }
  return scopes;
}

/** Every .md file under a folder (subfolders too, as Claude Code reads them), relative paths. */
async function markdownFiles(root: string): Promise<string[]> {
  const found: string[] = [];
  const walk = async (rel: string, depth: number): Promise<void> => {
    if (depth > MAX_DEPTH || found.length >= MAX_FILES) return;
    let entries;
    try {
      entries = await readdir(path.join(root, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.') || found.length >= MAX_FILES) continue;
      const child = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) await walk(child, depth + 1);
      else if (entry.name.endsWith('.md') && (entry.isFile() || entry.isSymbolicLink())) {
        found.push(child);
      }
    }
  };
  await walk('', 0);
  return found;
}

interface ParsedFile {
  readonly doc: Document | null;
  readonly body: string;
  readonly problem: string | null;
}

export function parseAgentText(text: string): ParsedFile {
  const match = FRONTMATTER.exec(text);
  if (match === null) {
    return {
      doc: null,
      body: text,
      problem: 'No frontmatter (--- name, description ---) at the top',
    };
  }
  const doc = parseDocument(match[1] ?? '');
  const body = text.slice(match[0].length).replace(/^\r?\n/, '');
  if (doc.errors.length > 0) {
    return {
      doc: null,
      body,
      problem: `The frontmatter is not valid YAML: ${doc.errors[0]?.message ?? ''}`,
    };
  }
  if (doc.contents !== null && !isMap(doc.contents)) {
    return { doc: null, body, problem: 'The frontmatter is not a list of key: value lines' };
  }
  return { doc, body, problem: null };
}

const scalar = (value: unknown): string | null =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : null;

/** Tools as written: "Read, Grep" or a YAML list; missing means every tool. */
function toolsOf(value: unknown): string[] | null {
  if (Array.isArray(value))
    return value
      .map(String)
      .map((t) => t.trim())
      .filter(Boolean);
  const line = scalar(value);
  if (line === null) return null;
  return line
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/** The comment above the first key ("# Managed by …"), wherever the parser put it. */
function topComment(doc: Document): string | null {
  const first = isMap(doc.contents) ? doc.contents.items[0] : undefined;
  const firstKey: unknown = first?.key;
  const keyComment =
    typeof firstKey === 'object' && firstKey !== null && 'commentBefore' in firstKey
      ? firstKey.commentBefore
      : undefined;
  const comment =
    doc.commentBefore ??
    (isMap(doc.contents) ? doc.contents.commentBefore : undefined) ??
    (typeof keyComment === 'string' ? keyComment : undefined);
  const trimmed = comment?.trim();
  return trimmed === undefined || trimmed === '' ? null : trimmed;
}

function describe(
  scope: string,
  root: string,
  file: string,
  raw: string,
  modifiedAt: number,
): CustomAgent {
  const parsed = parseAgentText(raw);
  const fields = (parsed.doc?.toJS() ?? {}) as Record<string, unknown>;
  const fallbackName = path.basename(file, '.md');
  return {
    scope,
    file,
    path: path.join(root, file),
    name: scalar(fields.name) ?? fallbackName,
    description: scalar(fields.description) ?? '',
    tools: toolsOf(fields.tools),
    model: scalar(fields.model),
    color: scalar(fields.color),
    prompt: parsed.body,
    note: parsed.doc === null ? null : topComment(parsed.doc),
    problem: parsed.problem,
    modifiedAt,
  };
}

async function readAgent(scope: CustomAgentScope, file: string): Promise<CustomAgent | null> {
  const full = path.join(scope.dir, file);
  try {
    const info = await stat(full);
    if (!info.isFile()) return null;
    if (info.size > MAX_FILE_BYTES) {
      return {
        ...describe(scope.id, scope.dir, file, '', Math.round(info.mtimeMs)),
        prompt: '',
        problem: 'Too big to open here',
      };
    }
    return describe(
      scope.id,
      scope.dir,
      file,
      await readFile(full, 'utf8'),
      Math.round(info.mtimeMs),
    );
  } catch {
    return null;
  }
}

export async function listCustomAgents(
  scopes: readonly CustomAgentScope[],
): Promise<CustomAgent[]> {
  const lists = await Promise.all(
    scopes.map(async (scope) => {
      if (!scope.exists) return [];
      const files = await markdownFiles(scope.dir);
      const agents = await Promise.all(files.map((file) => readAgent(scope, file)));
      return agents.filter((a): a is CustomAgent => a !== null);
    }),
  );
  return lists.flat();
}

/**
 * The file's new text: the frontmatter keeps its comments, key order and any keys we do not
 * edit; the body becomes the prompt.
 */
export function renderAgentText(existing: string | null, input: CustomAgentInput): string {
  const parsed = existing === null ? null : parseAgentText(existing);
  if (parsed !== null && parsed.problem !== null) {
    throw new CustomAgentError(409, `${parsed.problem}; fix the file by hand first.`);
  }
  const doc = parsed?.doc ?? new Document({});
  doc.contents ??= doc.createNode({});
  doc.set('name', input.name);
  doc.set('description', input.description);
  if (input.tools === null) doc.delete('tools');
  // A list stays a list; otherwise the usual "Read, Grep, Glob".
  else if (isSeq(doc.get('tools', true))) doc.set('tools', input.tools);
  else doc.set('tools', input.tools.join(', '));
  if (input.model === null) doc.delete('model');
  else doc.set('model', input.model);
  if (input.color === null) doc.delete('color');
  else doc.set('color', input.color);
  const front = doc.toString({ lineWidth: 0 }).trimEnd();
  const prompt = input.prompt.replace(/\s+$/, '');
  return `---\n${front}\n---\n\n${prompt}${prompt === '' ? '' : '\n'}`;
}

/** A file path from the browser, kept inside the scope's folder and to .md files. */
function resolveInside(scope: CustomAgentScope, file: string): string {
  const full = path.resolve(scope.dir, file);
  const root = path.resolve(scope.dir) + path.sep;
  if (!full.startsWith(root) || !full.endsWith('.md') || file.includes('\0')) {
    throw new CustomAgentError(400, 'That file is not in the agents folder.');
  }
  return full;
}

async function nameTaken(
  scope: CustomAgentScope,
  name: string,
  except: string | undefined,
): Promise<string | null> {
  const agents = await listCustomAgents([{ ...scope, exists: await exists(scope.dir) }]);
  return agents.find((a) => a.name === name && a.file !== except)?.file ?? null;
}

/** Creates (no file) or updates an agent file, and returns it as read back. */
export async function saveCustomAgent(
  scope: CustomAgentScope,
  input: CustomAgentInput,
  update?: { readonly file: string; readonly modifiedAt?: number },
): Promise<CustomAgent> {
  const clash = await nameTaken(scope, input.name, update?.file);
  if (clash !== null) {
    throw new CustomAgentError(409, `${clash} already uses the name "${input.name}".`);
  }

  if (update === undefined) {
    const file = `${input.name}.md`;
    const full = resolveInside(scope, file);
    await mkdir(scope.dir, { recursive: true });
    try {
      // wx: never replace a file that appeared meanwhile.
      await writeFile(full, renderAgentText(null, input), { flag: 'wx', mode: 0o644 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new CustomAgentError(409, `${file} is already there.`);
      }
      throw error;
    }
    return mustRead(scope, file);
  }

  const full = resolveInside(scope, update.file);
  let info;
  try {
    info = await lstat(full);
  } catch {
    throw new CustomAgentError(404, 'That agent file is gone.');
  }
  if (!info.isFile())
    throw new CustomAgentError(409, 'That agent file is a link; edit it where it points.');
  if (update.modifiedAt !== undefined && Math.round(info.mtimeMs) !== update.modifiedAt) {
    throw new CustomAgentError(
      409,
      'The file changed on disk since you opened it. Reload to see it.',
    );
  }
  const next = renderAgentText(await readFile(full, 'utf8'), input);
  // Write beside it, then swap: a crash never leaves half a file.
  const temp = path.join(path.dirname(full), `.${path.basename(full)}.${String(process.pid)}.tmp`);
  await writeFile(temp, next, { mode: info.mode & 0o777 });
  await rename(temp, full);
  return mustRead(scope, update.file);
}

async function mustRead(scope: CustomAgentScope, file: string): Promise<CustomAgent> {
  const agent = await readAgent({ ...scope, exists: true }, file);
  if (agent === null) throw new CustomAgentError(404, 'The agent file could not be read back.');
  return agent;
}

/** Moves an agent file to the trash folder (not deleted), and says where it went. */
export async function trashCustomAgent(
  scope: CustomAgentScope,
  file: string,
  trashDir: string,
): Promise<string> {
  const full = resolveInside(scope, file);
  try {
    if (!(await lstat(full)).isFile()) throw new CustomAgentError(409, 'That is not a file.');
  } catch (error) {
    if (error instanceof CustomAgentError) throw error;
    throw new CustomAgentError(404, 'That agent file is gone.');
  }
  await mkdir(trashDir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(trashDir, `${stamp}-${file.replaceAll('/', '__')}`);
  try {
    await rename(full, target);
  } catch (error) {
    // Another disk: copy, then remove.
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
    await copyFile(full, target);
    await unlink(full);
  }
  return target;
}
