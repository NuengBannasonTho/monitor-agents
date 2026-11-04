import type { AgentEvent } from '@agent-office/shared';
import { z } from 'zod';
import { safeLabel, summarizeTool } from '../summarize.js';
import type { Adapter, Clock } from './types.js';

/*
 * Field names verified against Claude Code 2.1.318: the hooks reference
 * (https://code.claude.com/docs/en/hooks) and the hook input schemas shipped in
 * the CLI itself. Only the fields we use are declared; zod strips the rest, so
 * prompts, tool_input bodies and assistant messages never leave this file.
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
  Base.extend({ hook_event_name: z.literal('UserPromptSubmit') }),
  Base.extend({
    hook_event_name: z.literal('PreToolUse'),
    tool_name: z.string().min(1),
    tool_input: ToolInput.optional(),
  }),
  Base.extend({
    hook_event_name: z.literal('Notification'),
    notification_type: z.string().optional(),
  }),
  Base.extend({ hook_event_name: z.literal('Stop') }),
  Base.extend({ hook_event_name: z.literal('SubagentStop') }),
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

const SESSION_START_LABEL: Readonly<Record<string, string>> = {
  startup: 'Session started',
  resume: 'Session resumed',
  clear: 'Conversation cleared',
  compact: 'Context compacted',
  fork: 'Session forked',
};

function subagentSuffix(p: HookPayload): string {
  return p.agent_id === undefined
    ? ''
    : ` (subagent${p.agent_type ? ` ${safeLabel(p.agent_type, 30)}` : ''})`;
}

export function createClaudeCodeAdapter(now: Clock = Date.now): Adapter {
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
          };
        case 'UserPromptSubmit':
          // The prompt text is intentionally never read.
          return { ...base, type: 'prompt', summary: 'Prompt received' };
        case 'PreToolUse':
          return {
            ...base,
            type: 'tool',
            toolName: p.tool_name,
            summary: summarizeTool(p.tool_name, p.tool_input ?? {}, p.cwd) + subagentSuffix(p),
          };
        case 'Notification': {
          const label = NEEDS_YOU_LABEL[p.notification_type ?? ''];
          if (label === undefined) return null;
          return { ...base, type: 'notify', summary: label };
        }
        case 'Stop':
          return { ...base, type: 'stop', summary: 'Finished' };
        case 'SubagentStop':
          return {
            ...base,
            type: 'subagent-stop',
            summary: `Subagent finished${p.agent_type ? `: ${safeLabel(p.agent_type, 30)}` : ''}`,
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
