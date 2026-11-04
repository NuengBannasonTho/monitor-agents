import type { Agent } from '@agent-office/shared';

/** Ids that just entered needs-you, plus the new set to remember. Pure. */
export function enteredNeedsYou(
  previous: ReadonlySet<string>,
  agents: readonly Agent[],
): { readonly current: ReadonlySet<string>; readonly entered: readonly string[] } {
  const current = new Set(agents.filter((a) => a.state === 'needs-you').map((a) => a.id));
  const entered = [...current].filter((id) => !previous.has(id));
  return { current, entered };
}
