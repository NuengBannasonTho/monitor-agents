import path from 'node:path';
import type { DetailPart } from '@agent-office/shared';
import { MAX_DETAIL_PARTS } from '@agent-office/shared';
import { redactSecrets, redactTokens } from './redact.js';
import { formatDuration, relativeToCwd } from './summarize.js';

/*
 * The full story behind an activity line, built from a hook payload: the command and its
 * output, the diff an edit made, the prompt, Claude's reply. Everything is redacted and
 * size-capped here, before it reaches the store, and only lives in memory.
 */

/** Longest prose kept (a prompt, a reply). */
export const TEXT_MAX = 6_000;
/** Longest code kept (a diff, file content, a command). */
export const CODE_MAX = 6_000;
/** Longest output kept: its last part, where errors and results usually are. */
export const OUTPUT_MAX = 4_000;
const JSON_MAX = 3_000;
const FIELD_MAX = 300;
const FILES_MAX = 30;

type Input = Readonly<Record<string, unknown>>;

function str(input: Input, key: string): string | undefined {
  const value = input[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function num(input: Input, key: string): number | undefined {
  const value = input[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function record(value: unknown): Input {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Input)
    : {};
}

function lineCount(text: string): number {
  return text === '' ? 0 : text.split('\n').length;
}

/** The start of `text`, cut at a line break when one is near, with a note of how much was cut. */
export function clipHead(text: string, max: number): string {
  if (text.length <= max) return text;
  const lastBreak = text.lastIndexOf('\n', max);
  const end = lastBreak > max / 2 ? lastBreak : max;
  const rest = text.slice(end).replace(/^\n/, '');
  const lines = lineCount(rest);
  return `${text.slice(0, end)}\n… ${lines > 1 ? `${String(lines)} more lines` : 'cut'}`;
}

/** The end of `text`, with a note that earlier output was dropped. */
export function clipTail(text: string, max: number): string {
  if (text.length <= max) return text;
  return `… earlier output trimmed\n${text.slice(text.length - max)}`;
}

const LANG_BY_EXT: Readonly<Record<string, string>> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  json: 'json',
  jsonc: 'jsonc',
  css: 'css',
  scss: 'scss',
  html: 'html',
  vue: 'vue',
  svelte: 'svelte',
  md: 'markdown',
  mdx: 'mdx',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  sh: 'shellscript',
  bash: 'shellscript',
  zsh: 'shellscript',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  sql: 'sql',
  xml: 'xml',
  svg: 'xml',
  graphql: 'graphql',
  dockerfile: 'docker',
};

/** Highlighting language for a file, by its extension; plain text when unknown. */
export function langForPath(filePath: string): string {
  const base = path.basename(filePath).toLowerCase();
  if (base === 'dockerfile') return 'docker';
  const ext = base.includes('.') ? (base.split('.').pop() ?? '') : '';
  return LANG_BY_EXT[ext] ?? 'text';
}

/** `.env`-style files are all secrets; everything else only loses known token shapes. */
function redactFile(filePath: string, content: string): string {
  return /(^|\/)\.env/i.test(filePath) ? redactSecrets(content) : redactTokens(content);
}

function field(label: string, value: string): DetailPart {
  return {
    type: 'field',
    label,
    value: clipHead(redactSecrets(value.replace(/\s+/g, ' ').trim()), FIELD_MAX),
  };
}

function text(label: string, body: string, max = TEXT_MAX): DetailPart {
  return { type: 'text', label, text: clipHead(redactSecrets(body.trim()), max) };
}

function code(label: string, body: string, lang: string): DetailPart {
  return { type: 'code', label, code: body, lang };
}

/** Lines removed and added, as a diff block. */
function diff(oldText: string, newText: string): string {
  const minus = oldText === '' ? [] : oldText.split('\n').map((l) => `- ${l}`);
  const plus = newText === '' ? [] : newText.split('\n').map((l) => `+ ${l}`);
  return [...minus, ...plus].join('\n');
}

function fileField(input: Input, cwd: string, key = 'file_path'): DetailPart[] {
  const file = str(input, key);
  return file === undefined ? [] : [field('File', relativeToCwd(file, cwd))];
}

function editDiffs(input: Input, filePath: string): string {
  const edits = Array.isArray(input.edits) ? input.edits.map(record) : [input];
  return edits
    .map((e) => diff(str(e, 'old_string') ?? '', str(e, 'new_string') ?? ''))
    .filter((d) => d !== '')
    .map((d) => redactFile(filePath, d))
    .join('\n\n');
}

function todoList(input: Input): string | undefined {
  if (!Array.isArray(input.todos)) return undefined;
  const mark: Readonly<Record<string, string>> = {
    completed: '[x]',
    in_progress: '[~]',
    pending: '[ ]',
  };
  return input.todos
    .map(record)
    .map((t) => `${mark[str(t, 'status') ?? ''] ?? '[ ]'} ${str(t, 'content') ?? ''}`)
    .join('\n');
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

/** Keeps a detail within the part limit. */
function capped(parts: readonly DetailPart[]): DetailPart[] {
  return parts.slice(0, MAX_DETAIL_PARTS);
}

/** What a tool call was asked to do. */
export function toolCallDetail(toolName: string, input: Input, cwd: string): DetailPart[] {
  const parts: DetailPart[] = [];
  switch (toolName) {
    case 'Bash': {
      const command = str(input, 'command');
      const description = str(input, 'description');
      if (description !== undefined) parts.push(field('What', description));
      if (command !== undefined) {
        parts.push(code('Command', clipHead(redactSecrets(command), CODE_MAX), 'shellscript'));
      }
      if (input.run_in_background === true) parts.push(field('Runs', 'In the background'));
      break;
    }
    case 'Read': {
      parts.push(...fileField(input, cwd));
      const offset = num(input, 'offset');
      const limit = num(input, 'limit');
      if (offset !== undefined || limit !== undefined) {
        const from = offset ?? 1;
        parts.push(
          field(
            'Lines',
            limit === undefined
              ? `${String(from)}+`
              : `${String(from)}–${String(from + limit - 1)}`,
          ),
        );
      }
      break;
    }
    case 'Edit':
    case 'MultiEdit': {
      const file = str(input, 'file_path') ?? '';
      parts.push(...fileField(input, cwd));
      if (input.replace_all === true) parts.push(field('Replace', 'Every match'));
      const changes = editDiffs(input, file);
      if (changes !== '') parts.push(code('Change', clipHead(changes, CODE_MAX), 'diff'));
      break;
    }
    case 'Write': {
      const file = str(input, 'file_path') ?? '';
      const content = str(input, 'content');
      parts.push(...fileField(input, cwd));
      if (content !== undefined) {
        parts.push(field('Size', `${String(lineCount(content))} lines`));
        parts.push(
          code('Content', clipHead(redactFile(file, content), CODE_MAX), langForPath(file)),
        );
      }
      break;
    }
    case 'NotebookEdit': {
      parts.push(...fileField(input, cwd, 'notebook_path'));
      const source = str(input, 'new_source');
      if (source !== undefined) {
        parts.push(code('Cell', clipHead(redactTokens(source), CODE_MAX), 'python'));
      }
      break;
    }
    case 'Grep': {
      const pattern = str(input, 'pattern');
      if (pattern !== undefined) parts.push(code('Pattern', redactSecrets(pattern), 'regexp'));
      for (const [key, label] of [
        ['path', 'In'],
        ['glob', 'Files'],
        ['type', 'Type'],
        ['output_mode', 'Shows'],
      ] as const) {
        const value = str(input, key);
        if (value !== undefined) {
          parts.push(field(label, key === 'path' ? relativeToCwd(value, cwd) : value));
        }
      }
      break;
    }
    case 'Glob': {
      const pattern = str(input, 'pattern');
      const where = str(input, 'path');
      if (pattern !== undefined) parts.push(field('Pattern', pattern));
      if (where !== undefined) parts.push(field('In', relativeToCwd(where, cwd)));
      break;
    }
    case 'WebFetch': {
      const url = str(input, 'url');
      const prompt = str(input, 'prompt');
      if (url !== undefined) parts.push(field('URL', url));
      if (prompt !== undefined) parts.push(text('Asked', prompt));
      break;
    }
    case 'WebSearch': {
      const query = str(input, 'query');
      if (query !== undefined) parts.push(field('Search', query));
      break;
    }
    case 'Task':
    case 'Agent': {
      const type = str(input, 'subagent_type');
      const description = str(input, 'description');
      const prompt = str(input, 'prompt');
      if (type !== undefined) parts.push(field('Agent', type));
      if (description !== undefined) parts.push(field('Task', description));
      if (prompt !== undefined) parts.push(text('Brief', prompt));
      break;
    }
    case 'TodoWrite': {
      const todos = todoList(input);
      if (todos !== undefined && todos !== '') parts.push(text('Plan', todos));
      break;
    }
    case 'Skill': {
      const skill = str(input, 'skill');
      const args = str(input, 'args');
      if (skill !== undefined) parts.push(field('Skill', skill));
      if (args !== undefined) parts.push(text('Arguments', args));
      break;
    }
    default: {
      // MCP and other tools: their input as JSON, so nothing is hidden behind the name.
      if (Object.keys(input).length > 0) {
        parts.push(code('Input', clipHead(redactSecrets(prettyJson(input)), JSON_MAX), 'json'));
      }
    }
  }
  return capped(parts);
}

function joinedOutput(response: Input): string {
  const out = str(response, 'stdout') ?? '';
  const err = str(response, 'stderr') ?? '';
  return [out, err].filter((s) => s.trim() !== '').join('\n');
}

function foundFiles(response: Input, cwd: string): string | undefined {
  if (!Array.isArray(response.filenames)) return undefined;
  const files = response.filenames.filter((f): f is string => typeof f === 'string');
  if (files.length === 0) return undefined;
  const shown = files.slice(0, FILES_MAX).map((f) => relativeToCwd(f, cwd));
  const more = files.length - shown.length;
  return more > 0 ? `${shown.join('\n')}\n… ${String(more)} more` : shown.join('\n');
}

function reportText(response: Input): string | undefined {
  if (!Array.isArray(response.content)) return str(response, 'result');
  const texts = response.content
    .map(record)
    .map((c) => str(c, 'text'))
    .filter((t): t is string => t !== undefined);
  return texts.length === 0 ? undefined : texts.join('\n\n');
}

/** What a finished tool call gave back. */
export function toolResultDetail(
  toolName: string,
  rawResponse: unknown,
  durationMs: number | undefined,
  cwd: string,
): DetailPart[] {
  const response = record(rawResponse);
  const parts: DetailPart[] = [];
  if (durationMs !== undefined) parts.push(field('Took', formatDuration(durationMs)));
  switch (toolName) {
    case 'Bash': {
      const output = joinedOutput(response);
      parts.push(
        output.trim() === ''
          ? field('Output', 'None')
          : code('Output', clipTail(redactSecrets(output), OUTPUT_MAX), 'text'),
      );
      if (response.interrupted === true) parts.push(field('Ended', 'Interrupted'));
      break;
    }
    case 'Grep':
    case 'Glob': {
      const files = foundFiles(response, cwd);
      const content = str(response, 'content');
      if (content !== undefined) {
        parts.push(code('Matches', clipHead(redactSecrets(content), OUTPUT_MAX), 'text'));
      } else if (files !== undefined) {
        parts.push(code('Found', redactSecrets(files), 'text'));
      } else {
        parts.push(field('Found', 'Nothing'));
      }
      break;
    }
    case 'WebFetch':
    case 'Task':
    case 'Agent': {
      const report = reportText(response);
      if (report !== undefined)
        parts.push(text(toolName === 'WebFetch' ? 'Result' : 'Report', report));
      break;
    }
  }
  return capped(parts);
}

/** Why a tool call failed. */
export function toolFailureDetail(error: string | undefined, durationMs: number | undefined) {
  const parts: DetailPart[] = [];
  if (durationMs !== undefined) parts.push(field('Took', formatDuration(durationMs)));
  if (error !== undefined && error.trim() !== '') {
    parts.push(code('Error', clipTail(redactSecrets(error), OUTPUT_MAX), 'text'));
  }
  return parts;
}

/** A prompt, a reply or a notice, as prose. */
export function proseDetail(label: string, body: string | undefined): DetailPart[] | undefined {
  return body === undefined || body.trim() === '' ? undefined : [text(label, body)];
}

export function fieldsDetail(
  entries: readonly (readonly [string, string | undefined])[],
): DetailPart[] | undefined {
  const parts = entries
    .filter((e): e is readonly [string, string] => e[1] !== undefined && e[1] !== '')
    .map(([label, value]) => field(label, value));
  return parts.length === 0 ? undefined : parts;
}
