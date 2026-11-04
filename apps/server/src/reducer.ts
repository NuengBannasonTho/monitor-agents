import { MAX_ACTIVITY, deskFromCwd } from '@agent-office/shared';
import type { ActivityEntry, Agent, AgentEvent, AgentState } from '@agent-office/shared';
import { stateForTool } from './summarize.js';

/** How long an agent shows 'done' before settling back to 'idle'. */
export const DONE_SETTLE_MS = 3_000;

/**
 * Synthetic event scheduled by the store (never by the reducer itself) to move a
 * 'done' agent back to 'idle'. `since` is the agent's lastSeen when it became
 * done; if anything happened after that, the settle is stale and ignored.
 */
export interface SettleEvent {
  readonly type: 'settle';
  readonly sessionId: string;
  readonly since: number;
  readonly at: number;
}

export type ReducerEvent = AgentEvent | SettleEvent;
export type AgentMap = ReadonlyMap<string, Agent>;

function nextState(current: AgentState, event: AgentEvent): AgentState {
  switch (event.type) {
    case 'start':
      return 'idle';
    case 'prompt':
      return 'called';
    case 'tool':
      return stateForTool(event.toolName ?? '');
    case 'notify':
      return 'needs-you';
    case 'stop':
      return 'done';
    case 'subagent-stop':
      // A subagent finishing does not finish the main agent.
      return current === 'stale' || current === 'idle' ? 'working' : current;
    case 'end':
      return current;
  }
}

function withActivity(agent: Agent, entry: ActivityEntry): Agent['activity'] {
  return [entry, ...agent.activity].slice(0, MAX_ACTIVITY);
}

function newAgent(event: AgentEvent): Agent {
  return {
    id: event.sessionId,
    kind: event.kind,
    // The desk is fixed at first sight: hook `cwd` follows `cd`, the worktree does not.
    desk: deskFromCwd(event.cwd),
    cwd: event.cwd,
    state: 'idle',
    activity: [],
    lastSeen: event.at,
  };
}

/** Pure: returns a new map (or the same instance when nothing changed). */
export function reduce(agents: AgentMap, event: ReducerEvent): AgentMap {
  const existing = agents.get(event.sessionId);

  if (event.type === 'settle') {
    if (existing?.state !== 'done' || existing.lastSeen !== event.since) return agents;
    const next = new Map(agents);
    next.set(existing.id, { ...existing, state: 'idle' });
    return next;
  }

  if (event.type === 'end') {
    if (existing === undefined) return agents;
    const next = new Map(agents);
    next.delete(event.sessionId);
    return next;
  }

  // Unknown sessions (e.g. server restarted mid-session) are created on the fly.
  const agent = existing ?? newAgent(event);
  const state = nextState(agent.state, event);
  const entry: ActivityEntry = { at: event.at, state, summary: event.summary ?? event.type };
  const next = new Map(agents);
  next.set(agent.id, {
    ...agent,
    state,
    lastSeen: Math.max(agent.lastSeen, event.at),
    activity: withActivity(agent, entry),
  });
  return next;
}

/** Sweeper settings; both measured from an agent's lastSeen. */
export interface SweepPolicy {
  readonly staleAfterMs: number;
  readonly removeAfterMs: number;
  /**
   * An agent waiting on you (permission prompt) is silent by design; it stays
   * visible, never goes stale, and is only dropped after this long.
   */
  readonly needsYouRemoveAfterMs?: number;
}

export const DEFAULT_NEEDS_YOU_REMOVE_MS = 60 * 60_000;

function minutes(ms: number): string {
  const m = Math.round(ms / 60_000);
  return `${m} min`;
}

/**
 * Pure: marks agents with no events for `staleAfterMs` as stale and drops those
 * silent for `removeAfterMs` (crashed or closed sessions that never sent
 * SessionEnd). Returns the same map instance when nothing changed.
 */
export function sweep(agents: AgentMap, now: number, policy: SweepPolicy): AgentMap {
  let next: Map<string, Agent> | null = null;
  for (const agent of agents.values()) {
    const silentFor = now - agent.lastSeen;
    if (agent.state === 'needs-you') {
      if (silentFor >= (policy.needsYouRemoveAfterMs ?? DEFAULT_NEEDS_YOU_REMOVE_MS)) {
        next ??= new Map(agents);
        next.delete(agent.id);
      }
      continue;
    }
    if (silentFor >= policy.removeAfterMs) {
      next ??= new Map(agents);
      next.delete(agent.id);
    } else if (silentFor >= policy.staleAfterMs && agent.state !== 'stale') {
      next ??= new Map(agents);
      next.set(agent.id, {
        ...agent,
        state: 'stale',
        // lastSeen is unchanged: stale is a guess, not a real event.
        activity: withActivity(agent, {
          at: now,
          state: 'stale',
          summary: `No events for ${minutes(policy.staleAfterMs)}`,
        }),
      });
    }
  }
  return next ?? agents;
}
