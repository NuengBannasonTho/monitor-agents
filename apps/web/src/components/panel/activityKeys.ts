import type { ActivityEntry } from '@agent-office/shared';

/**
 * Stable React keys for activity entries (which carry no id). Identical entries
 * in the same millisecond get an occurrence suffix so keys never collide.
 */
export function activityKeys(entries: readonly ActivityEntry[]): string[] {
  const seen = new Map<string, number>();
  // Count from the oldest end so an entry keeps its key as newer ones arrive.
  const keys = new Array<string>(entries.length);
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e === undefined) continue;
    const base = `${e.at}|${e.state}|${e.summary}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    keys[i] = n === 0 ? base : `${base}#${n}`;
  }
  return keys;
}
