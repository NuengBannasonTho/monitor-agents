import { zoneOf } from '@agent-office/shared';
import type { Agent } from '@agent-office/shared';
import { APP_NAME } from './brand';

/*
 * What deserves your attention, as plain functions of the agent list: who is waiting on
 * you, and whose finished answer you have not opened yet.
 */

/** Agents waiting on you, the longest wait first. */
export function waitingOnYou(agents: readonly Agent[]): Agent[] {
  return agents
    .filter((a) => a.state === 'needs-you')
    .sort((a, b) => a.stateSince - b.stateSince || a.id.localeCompare(b.id));
}

/**
 * Agents that finished a turn you have not opened since, oldest first. `seen` holds the
 * finish time you last opened per agent; finishes before `baseline` (when this browser
 * started keeping track) count as seen.
 */
export function unseenFinished(
  agents: readonly Agent[],
  seen: Readonly<Record<string, number>>,
  baseline: number,
): Agent[] {
  return agents
    .filter(
      (a) =>
        a.finishedAt !== undefined &&
        zoneOf(a.state) === 'lounge' &&
        a.finishedAt > (seen[a.id] ?? baseline),
    )
    .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0) || a.id.localeCompare(b.id));
}

/**
 * Agents that finished a turn since `previous` (finish time per known agent, 0 for none),
 * plus the map to remember. Agents not in `previous` are new to us and never count. Pure.
 */
export function justFinished(
  previous: ReadonlyMap<string, number>,
  agents: readonly Agent[],
): { readonly current: ReadonlyMap<string, number>; readonly finished: readonly Agent[] } {
  const current = new Map<string, number>();
  const finished: Agent[] = [];
  for (const a of agents) {
    const at = a.finishedAt ?? 0;
    current.set(a.id, at);
    const before = previous.get(a.id);
    if (before !== undefined && at > before) finished.push(a);
  }
  return { current, finished };
}

/** Browser tab title: waiting agents first, then unread finishes. */
export function tabTitle(waiting: number, finished: number): string {
  if (waiting > 0) return `(${String(waiting)}) Needs you – ${APP_NAME}`;
  if (finished > 0) return `(${String(finished)}) Finished – ${APP_NAME}`;
  return APP_NAME;
}
