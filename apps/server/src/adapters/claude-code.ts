import type { AgentEvent } from '@agent-office/shared';
import { z } from 'zod';
import {
  fieldsDetail,
  proseDetail,
  toolCallDetail,
  toolFailureDetail,
  toolResultDetail,
} from '../details.js';
import { formatDuration, safeLabel, summarizeTool } from '../summarize.js';
import type { Adapter, Clock } from './types.js';

/*
 * Field names verified against Claude Code 2.1.318: the hooks reference
 * (https://code.claude.com/docs/en/hooks) and the hook input schemas shipped in
 * the CLI itself. Only the fields we use are declared; zod strips the rest.
 *
 * Activity summaries never hold a prompt, tool input body or reply. With details on
 * (the default), those go into each line's detail, redacted and size-capped by
 * details.ts; with details off they never leave this file.
 */

const Base = z.object({
  session_id: z.string().min(1),
  cwd: z.string(),
  /** Present only when the hook fires inside a subagent. */
  agent_id: z.string().optional(),
  agent_type: z.string().optional(),
});

const ToolInput = z.record(z.string(), z.unknown()).catch({});

const HookPayload = z.discriminatedUnion('hook_event_name', [
  Base.extend({
    hook_event_name: z.literal('SessionStart'),
    source: z.string().optional(), // startup | resume | clear | compact | fork
  }),
  Base.extend({
    hook_event_name: z.literal('UserPromptSubmit'),
    prompt: z.string().optional(),
  }),
  Base.extend({
    hook_event_name: z.literal('PreToolUse'),
    tool_name: z.string().min(1),
    tool_input: ToolInput.optional(),
    tool_use_id: z.string().optional(),
  }),
  Base.extend({
    hook_event_name: z.literal('PostToolUse'),
    tool_name: z.string().min(1),
    tool_use_id: z.string().optional(),
    duration_ms: z.number().nonnegative().optional(),
    tool_response: z.unknown().optional(),
  }),
  Base.extend({
    hook_event_name: z.literal('PostToolUseFailure'),
    tool_name: z.string().min(1),
    tool_use_id: z.string().optional(),
    duration_ms: z.number().nonnegative().optional(),
    /** Its leading "Exit code N" goes in the summary; the text only in the detail. */
    error: z.string().optional(),
    is_interrupt: z.boolean().optional(),
  }),
  Base.extend({
    hook_event_name: z.literal('Notification'),
    notification_type: z.string().optional(),
    message: z.string().optional(),
  }),
  Base.extend({
    hook_event_name: z.literal('Stop'),
    last_assistant_message: z.string().optional(),
  }),
  Base.extend({ hook_event_name: z.literal('SubagentStart') }),
  Base.extend({
    hook_event_name: z.literal('SubagentStop'),
    last_assistant_message: z.string().optional(),
  }),
  Base.extend({
    hook_event_name: z.literal('SessionEnd'),
    reason: z.string().optional(),
  }),
]);
type HookPayload = z.infer<typeof HookPayload>;

/**
 * Notification types that mean "a human has to act". `idle_prompt` (Claude has
 * been waiting a while after finishing) and `auth_success` are informational and
 * would otherwise pull a finished agent back to the table.
 */
const NEEDS_YOU_LABEL: Readonly<Record<string, string>> = {
  permission_prompt: 'Needs permission',
  elicitation_dialog: 'Waiting for your input',
  agent_needs_input: 'Needs your input',
};

/** Successful tool calls at least this long get an activity line ("Bash finished after 2m 5s"). */
export const LONG_TOOL_MS = 30_000;

function exitCode(error: string | undefined): number | undefined {
  const match = /^Exit code (\d+)/.exec(error ?? '');
  return match?.[1] === undefined ? undefined : Number.parseInt(match[1], 10);
}

const SESSION_START_LABEL: Readonly<Record<string, string>> = {
  startup: 'Session started',
  resume: 'Session resumed',
  clear: 'Conversation cleared',
  compact: 'Context compacted',
  fork: 'Session forked',
};

/** Which subagent an event comes from, when it comes from one. */
function subagentOf(p: HookPayload): Pick<AgentEvent, 'subagentId' | 'subagentType'> {
  if (p.agent_id === undefined) return {};
  return {
    subagentId: p.agent_id,
    subagentType: p.agent_type === undefined ? 'subagent' : safeLabel(p.agent_type, 30),
  };
}

function subagentSuffix(p: HookPayload): string {
  return p.agent_id === undefined
    ? ''
    : ` (subagent${p.agent_type ? ` ${safeLabel(p.agent_type, 30)}` : ''})`;
}

export interface ClaudeCodeAdapterOptions {
  /** Keep each line's full detail (prompt, command, diff, output, reply). Default true. */
  readonly details?: boolean;
}

export function createClaudeCodeAdapter(
  now: Clock = Date.now,
  { details = true }: ClaudeCodeAdapterOptions = {},
): Adapter {
  /** Only with details on, and only when there is something to show. */
  const withDetail = (detail: AgentEvent['detail']) =>
    details && detail !== undefined && detail.length > 0 ? { detail } : {};

  return {
    kind: 'claude-code',
    normalize(raw: unknown): AgentEvent | null {
      const parsed = HookPayload.safeParse(raw);
      if (!parsed.success) return null;
      const p = parsed.data;
      const base = { sessionId: p.session_id, kind: 'claude-code' as const, cwd: p.cwd, at: now() };

      switch (p.hook_event_name) {
        case 'SessionStart':
          return {
            ...base,
            type: 'start',
            summary: SESSION_START_LABEL[p.source ?? 'startup'] ?? 'Session started',
            ...withDetail(fieldsDetail([['Folder', p.cwd]])),
          };
        case 'UserPromptSubmit':
          // The summary never holds the prompt; only the detail does.
          return {
            ...base,
            type: 'prompt',
            summary: 'Prompt received',
            ...withDetail(proseDetail('Prompt', p.prompt)),
          };
        case 'PreToolUse':
          return {
            ...base,
            type: 'tool',
            ...subagentOf(p),
            toolName: p.tool_name,
            ...(p.tool_use_id === undefined ? {} : { toolId: p.tool_use_id }),
            summary: summarizeTool(p.tool_name, p.tool_input ?? {}, p.cwd) + subagentSuffix(p),
            ...withDetail(toolCallDetail(p.tool_name, p.tool_input ?? {}, p.cwd)),
          };
        case 'PostToolUse': {
          const long = p.duration_ms !== undefined && p.duration_ms >= LONG_TOOL_MS;
          return {
            ...base,
            type: 'tool-end',
            ...subagentOf(p),
            toolName: p.tool_name,
            ...(p.tool_use_id === undefined ? {} : { toolId: p.tool_use_id }),
            ...(long
              ? {
                  summary: `${safeLabel(p.tool_name, 40)} finished after ${formatDuration(p.duration_ms ?? 0)}${subagentSuffix(p)}`,
                }
              : {}),
            ...withDetail(toolResultDetail(p.tool_name, p.tool_response, p.duration_ms, p.cwd)),
          };
        }
        case 'PostToolUseFailure': {
          const tool = safeLabel(p.tool_name, 40);
          const code = exitCode(p.error);
          const what =
            p.is_interrupt === true
              ? `${tool} interrupted`
              : code === undefined
                ? `${tool} failed`
                : `${tool} failed (exit ${String(code)})`;
          return {
            ...base,
            type: 'tool-end',
            ...subagentOf(p),
            toolName: p.tool_name,
            ...(p.tool_use_id === undefined ? {} : { toolId: p.tool_use_id }),
            failed: true,
            summary: what + subagentSuffix(p),
            ...withDetail(toolFailureDetail(p.error, p.duration_ms)),
          };
        }
        case 'Notification': {
          const label = NEEDS_YOU_LABEL[p.notification_type ?? ''];
          if (label === undefined) return null;
          return {
            ...base,
            type: 'notify',
            summary: label,
            ...withDetail(proseDetail('Message', p.message)),
          };
        }
        case 'Stop':
          return {
            ...base,
            type: 'stop',
            summary: 'Finished',
            ...withDetail(proseDetail('Reply', p.last_assistant_message)),
          };
        case 'SubagentStart':
          return {
            ...base,
            type: 'subagent-start',
            ...subagentOf(p),
            summary: `Subagent started${p.agent_type ? `: ${safeLabel(p.agent_type, 30)}` : ''}`,
          };
        case 'SubagentStop':
          return {
            ...base,
            type: 'subagent-stop',
            ...subagentOf(p),
            summary: `Subagent finished${p.agent_type ? `: ${safeLabel(p.agent_type, 30)}` : ''}`,
            ...withDetail(proseDetail('Report', p.last_assistant_message)),
          };
        case 'SessionEnd':
          return {
            ...base,
            type: 'end',
            summary: `Session ended${p.reason ? ` (${safeLabel(p.reason, 30)})` : ''}`,
          };
      }
    },
  };
}
