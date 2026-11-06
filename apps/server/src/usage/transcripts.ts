import type { FileHandle } from 'node:fs/promises';
import { open } from 'node:fs/promises';
import path from 'node:path';
import type { RequestTokens } from './pricing.js';
import { priceRequest } from './pricing.js';

/*
 * Claude Code's transcripts: one JSON object per line, appended as the session goes
 * (~/.claude/projects/<project>/<session>.jsonl, and <session>/subagents/agent-<id>.jsonl for
 * each subagent). Only what the usage page needs is kept: token counts per request, tool and
 * skill names, titles and folders. Never a prompt, reply or file content.
 *
 * One API response is written as several lines (one per content block), each carrying the
 * same usage, so requests are counted once by message id and request id.
 */

export interface MessageRecord {
  readonly at: number;
  readonly model: string;
  tokens: RequestTokens;
  costUsd: number | null;
  uncachedUsd: number | null;
  /** Prompt size of a main-chain request (what its context held); 0 inside a subagent. */
  context: number;
  readonly sidechain: boolean;
}

export interface ToolRecord {
  readonly at: number;
  readonly name: string;
  readonly sidechain: boolean;
}

export interface SkillRecord {
  readonly at: number;
  readonly name: string;
  /** You typed it as /name; otherwise Claude loaded it with the Skill tool. */
  readonly byYou: boolean;
  /** Size of the instructions it loaded, once seen. */
  chars: number | null;
  readonly toolUseId: string | null;
}

/** A subagent started with the Agent (formerly Task) tool. */
export interface AgentRunRecord {
  readonly at: number;
  readonly type: string;
}

export interface TranscriptFile {
  readonly path: string;
  /** The session it belongs to (a subagent's is its parent's). */
  sessionId: string;
  readonly subagent: boolean;
  /** A subagent file's kind, from its .meta.json. */
  agentType: string | null;
  cwd: string | null;
  title: string | null;
  readonly messages: MessageRecord[];
  readonly tools: ToolRecord[];
  readonly skills: SkillRecord[];
  readonly agentRuns: AgentRunRecord[];
  readonly compactions: number[];
  /** Bytes read so far: always the start of a line. */
  offset: number;
  size: number;
  mtimeMs: number;
  /** The last /command typed, so the skill it loads can be named after it. */
  lastCommand: string | null;
}

/** What is shared between files: requests and tool calls seen already (forks copy history). */
export interface ParseContext {
  readonly requests: Map<string, MessageRecord>;
  readonly toolUses: Set<string>;
}

export function newTranscriptFile(
  filePath: string,
  sessionId: string,
  subagent: boolean,
): TranscriptFile {
  return {
    path: filePath,
    sessionId,
    subagent,
    agentType: null,
    cwd: null,
    title: null,
    messages: [],
    tools: [],
    skills: [],
    agentRuns: [],
    compactions: [],
    offset: 0,
    size: 0,
    mtimeMs: 0,
    lastCommand: null,
  };
}

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const num = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
const str = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

const SKILL_PREFIX = 'Base directory for this skill:';
const COMMAND_NAME = /<command-name>\/?([^<\s]+)<\/command-name>/;
const AGENT_TOOLS = new Set(['Agent', 'Task']);

function tokensOf(usage: Json): RequestTokens {
  const written = num(usage.cache_creation_input_tokens);
  const split = isRecord(usage.cache_creation) ? usage.cache_creation : null;
  const write1h = split === null ? 0 : num(split.ephemeral_1h_input_tokens);
  const write5m = split === null ? written : num(split.ephemeral_5m_input_tokens);
  // Older transcripts have only the total; anything the split does not cover is 5-minute.
  const rest = Math.max(0, written - write1h - write5m);
  return {
    input: num(usage.input_tokens),
    output: num(usage.output_tokens),
    cacheRead: num(usage.cache_read_input_tokens),
    cacheWrite5m: write5m + rest,
    cacheWrite1h: write1h,
  };
}

const promptSize = (t: RequestTokens): number =>
  t.input + t.cacheRead + t.cacheWrite5m + t.cacheWrite1h;

function textOf(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (isRecord(block) && block.type === 'text' && typeof block.text === 'string') {
      return block.text;
    }
  }
  return null;
}

function onAssistant(file: TranscriptFile, line: Json, at: number, ctx: ParseContext): void {
  const message = line.message;
  if (!isRecord(message)) return;
  const model = str(message.model);
  // "<synthetic>" lines are Claude Code's own notices (API errors), not requests.
  if (model === null || model.startsWith('<')) return;
  const sidechain = line.isSidechain === true || file.subagent;
  const usage = isRecord(message.usage) ? message.usage : null;
  const id = str(message.id);

  if (usage !== null && id !== null) {
    const key = `${id}:${str(line.requestId) ?? ''}`;
    const tokens = tokensOf(usage);
    const priced = priceRequest(model, tokens, str(usage.speed) ?? undefined);
    const seen = ctx.requests.get(key);
    if (seen === undefined) {
      const record: MessageRecord = {
        at,
        model,
        tokens,
        costUsd: priced.costUsd,
        uncachedUsd: priced.uncachedUsd,
        context: sidechain ? 0 : promptSize(tokens),
        sidechain,
      };
      ctx.requests.set(key, record);
      file.messages.push(record);
    } else if (tokens.output > seen.tokens.output) {
      // A later line of the same response with a fuller count.
      seen.tokens = tokens;
      seen.costUsd = priced.costUsd;
      seen.uncachedUsd = priced.uncachedUsd;
      if (!seen.sidechain) seen.context = promptSize(tokens);
    }
  }

  if (!Array.isArray(message.content)) return;
  for (const block of message.content) {
    if (!isRecord(block) || block.type !== 'tool_use') continue;
    const name = str(block.name);
    const toolId = str(block.id);
    if (name === null) continue;
    if (toolId !== null) {
      if (ctx.toolUses.has(toolId)) continue;
      ctx.toolUses.add(toolId);
    }
    file.tools.push({ at, name, sidechain });
    const input = isRecord(block.input) ? block.input : {};
    if (name === 'Skill') {
      const skill = str(input.skill);
      if (skill !== null) {
        file.skills.push({
          at,
          name: skill,
          byYou: false,
          chars: null,
          toolUseId: toolId,
        });
      }
    } else if (AGENT_TOOLS.has(name)) {
      file.agentRuns.push({
        at,
        type: str(input.subagent_type) ?? 'general-purpose',
      });
    }
  }
}

/** A skill's instructions arriving in the context, after the Skill tool or a /command. */
function onSkillLoaded(file: TranscriptFile, line: Json, at: number, text: string): void {
  const source = str(line.sourceToolUseID);
  if (source !== null) {
    const call = file.skills.find((s) => s.toolUseId === source);
    if (call !== undefined) {
      call.chars = text.length;
      return;
    }
  }
  // Only right after you typed its /command. Otherwise Claude Code is putting a skill that
  // was already loaded back into the context after compacting: not a new use.
  const command = file.lastCommand;
  file.lastCommand = null;
  const folder = (text.split('\n', 1)[0] ?? '').slice(SKILL_PREFIX.length).trim();
  if (path.basename(folder) !== command?.split(':').pop()) return;
  file.skills.push({
    at,
    name: command,
    byYou: true,
    chars: text.length,
    toolUseId: null,
  });
}

/** Reads one line into the file's records; anything unexpected is skipped. */
export function parseLine(file: TranscriptFile, raw: string, ctx: ParseContext): void {
  // Cheap checks first: most lines (tool output, API request logs) are not needed at all.
  const assistant = raw.includes('"type":"assistant"');
  const title = !assistant && raw.includes('"type":"ai-title"');
  const compact = !assistant && raw.includes('"compact_boundary"');
  const skill = !assistant && raw.includes(SKILL_PREFIX);
  const command = !assistant && raw.includes('<command-name>');
  if (!assistant && !title && !compact && !skill && !command) return;

  let line: unknown;
  try {
    line = JSON.parse(raw);
  } catch {
    return;
  }
  if (!isRecord(line)) return;
  // A /command's skill loads before Claude answers; after that it names nothing.
  if (line.type === 'assistant') file.lastCommand = null;
  const parsedAt = typeof line.timestamp === 'string' ? Date.parse(line.timestamp) : Number.NaN;
  const at = Number.isNaN(parsedAt) ? file.mtimeMs : parsedAt;
  const cwd = str(line.cwd);
  // The folder it started in: later lines follow every `cd` the agent makes.
  if (cwd !== null && file.cwd === null) file.cwd = cwd;
  const session = str(line.sessionId);
  if (session !== null && !file.subagent) file.sessionId = session;

  switch (line.type) {
    case 'assistant':
      onAssistant(file, line, at, ctx);
      return;
    case 'ai-title': {
      const value = str(line.aiTitle);
      if (value !== null) file.title = value.slice(0, 200);
      return;
    }
    case 'system':
      if (line.subtype === 'compact_boundary') file.compactions.push(at);
      return;
    case 'user': {
      const message = isRecord(line.message) ? line.message : null;
      const text = message === null ? null : textOf(message.content);
      if (text === null) return;
      if (line.isMeta === true && text.startsWith(SKILL_PREFIX)) {
        onSkillLoaded(file, line, at, text);
        return;
      }
      const typed = text.startsWith('<command-') ? COMMAND_NAME.exec(text) : null;
      if (typed?.[1] !== undefined) file.lastCommand = typed[1].slice(0, 120);
      return;
    }
    default:
      return;
  }
}

const CHUNK_BYTES = 4 * 1024 * 1024;
const NEWLINE = 0x0a;

/**
 * Reads the complete lines between `start` and `end` and returns where the next read should
 * start: a line still being written is left for next time.
 */
export async function readLines(
  filePath: string,
  start: number,
  end: number,
  onLine: (line: string) => void,
): Promise<number> {
  let handle: FileHandle | null = null;
  try {
    handle = await open(filePath, 'r');
    let position = start;
    let lineStart = start;
    let carry: Buffer = Buffer.alloc(0);
    while (position < end) {
      const length = Math.min(CHUNK_BYTES, end - position);
      const chunk = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(chunk, 0, length, position);
      if (bytesRead === 0) break;
      position += bytesRead;
      let data = chunk.subarray(0, bytesRead);
      if (carry.length > 0) {
        data = Buffer.concat([carry, data]);
        carry = Buffer.alloc(0);
      }
      let from = 0;
      for (let nl = data.indexOf(NEWLINE, from); nl !== -1; nl = data.indexOf(NEWLINE, from)) {
        if (nl > from) onLine(data.toString('utf8', from, nl));
        lineStart += nl - from + 1;
        from = nl + 1;
      }
      carry = Buffer.from(data.subarray(from));
    }
    return lineStart;
  } catch {
    return start;
  } finally {
    await handle?.close();
  }
}
