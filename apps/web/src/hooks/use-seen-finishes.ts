import type { Agent } from '@agent-office/shared';
import { useCallback, useState } from 'react';
import { z } from 'zod';

const STORAGE_KEY = 'agent-office:seen-finishes:v1';
/** Enough for weeks of sessions; the oldest entries go first. */
const MAX_ENTRIES = 300;

const StoredSchema = z.object({
  /** When this browser started tracking: finishes before it count as seen. */
  baseline: z.number(),
  /** Finish time you last opened, per agent id. */
  seen: z.record(z.string(), z.number()),
});
type Stored = z.infer<typeof StoredSchema>;

function save(value: Stored): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable: badges still clear for this tab.
  }
}

function load(): Stored {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw === null ? null : StoredSchema.safeParse(JSON.parse(raw));
    if (parsed?.success === true) return parsed.data;
  } catch {
    // Fall through to a fresh start.
  }
  const fresh = { baseline: Date.now(), seen: {} };
  save(fresh);
  return fresh;
}

function prune(seen: Record<string, number>): Record<string, number> {
  const entries = Object.entries(seen);
  if (entries.length <= MAX_ENTRIES) return seen;
  return Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, MAX_ENTRIES));
}

/** Remembers, per browser, which finished turns you have opened. */
export function useSeenFinishes(): {
  readonly seen: Readonly<Record<string, number>>;
  readonly baseline: number;
  readonly markSeen: (agent: Agent) => void;
} {
  const [stored, setStored] = useState(load);
  const markSeen = useCallback((agent: Agent) => {
    const at = agent.finishedAt;
    if (at === undefined) return;
    setStored((current) => {
      if ((current.seen[agent.id] ?? 0) >= at) return current;
      const next = { ...current, seen: prune({ ...current.seen, [agent.id]: at }) };
      save(next);
      return next;
    });
  }, []);
  return { seen: stored.seen, baseline: stored.baseline, markSeen };
}
