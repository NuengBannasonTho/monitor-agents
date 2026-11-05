import type { ActivityEntry } from '@agent-office/shared';

/** What an activity line is about, to pick its icon. */
export type ActivityKind =
  | 'prompt'
  | 'read'
  | 'search'
  | 'terminal'
  | 'edit'
  | 'permission'
  | 'subagent'
  | 'finished'
  | 'start'
  | 'context'
  | 'sleep'
  | 'failed'
  | 'other';

const BY_TOOL: Readonly<Record<string, ActivityKind>> = {
  Read: 'read',
  NotebookRead: 'read',
  Grep: 'search',
  Glob: 'search',
  WebFetch: 'search',
  WebSearch: 'search',
  Bash: 'terminal',
  BashOutput: 'terminal',
  KillShell: 'terminal',
  Edit: 'edit',
  MultiEdit: 'edit',
  Write: 'edit',
  NotebookEdit: 'edit',
  TodoWrite: 'edit',
  Agent: 'subagent',
  Task: 'subagent',
};

/**
 * Reads the kind from the line itself: activity lines start with the tool name
 * ("Bash pnpm test", "Edit src/a.ts") or are one of the server's fixed phrases.
 */
export function activityKind(
  entry: Pick<ActivityEntry, 'state' | 'summary' | 'failed'>,
): ActivityKind {
  if (entry.failed === true) return 'failed';
  if (entry.state === 'needs-you') return 'permission';
  if (entry.state === 'stale') return 'sleep';
  if (entry.state === 'done') return 'finished';
  const { summary } = entry;
  if (summary.startsWith('Prompt')) return 'prompt';
  if (summary.startsWith('Finished')) return 'finished';
  if (summary.startsWith('Subagent')) return 'subagent';
  if (/^Session (started|resumed|forked)/.test(summary)) return 'start';
  if (/^(Context compacted|Conversation cleared)/.test(summary)) return 'context';
  const tool = /^(\S+)/.exec(summary)?.[1] ?? '';
  return BY_TOOL[tool] ?? 'other';
}
