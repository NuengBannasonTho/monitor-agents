import { isRecord } from '@agent-office/shared';
/**
 * A task MON MANG drafted, handed to the New task page to finish there: kept in this tab's
 * session storage until that page has read it.
 */
export interface TaskDraft {
  readonly provider: 'claude' | 'codex';
  readonly task: string;
  readonly repoId: string | null;
  readonly worktreeId: string | null;
  readonly team: readonly string[];
}

const KEY = 'agent-office:task-draft:v1';

export function handOffTaskDraft(draft: TaskDraft): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Storage blocked: New task opens empty.
  }
}

export function peekTaskDraft(): TaskDraft | null {
  try {
    const d: unknown = JSON.parse(window.sessionStorage.getItem(KEY) ?? 'null');
    if (!isRecord(d)) return null;
    if (typeof d.task !== 'string' || (d.provider !== 'claude' && d.provider !== 'codex'))
      return null;
    return {
      provider: d.provider,
      task: d.task,
      repoId: typeof d.repoId === 'string' ? d.repoId : null,
      worktreeId: typeof d.worktreeId === 'string' ? d.worktreeId : null,
      team: Array.isArray(d.team) ? d.team.filter((n): n is string => typeof n === 'string') : [],
    };
  } catch {
    return null;
  }
}

export function clearTaskDraft(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
