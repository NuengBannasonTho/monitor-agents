import { MAX_ACTIVITY, deskFromCwd } from '@agent-office/shared';
import type {
  ActivityEntry,
  Agent,
  AgentEvent,
  AgentState,
  RunningTool,
} from '@agent-office/shared';
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

function nextState(agent: Agent, event: AgentEvent): AgentState {
  const current = agent.state;
  switch (event.type) {
    case 'start':
      return 'idle';
    case 'prompt':
      return 'called';
    case 'tool':
      return stateForTool(event.toolName ?? '');
    case 'tool-end':
      // The tool that asked for permission ran, so you answered the prompt.
      if (current === 'needs-you') {
        return event.toolId === undefined || event.toolId === agent.tool?.id ? 'working' : current;
      }
      return current === 'stale' || current === 'idle' ? 'working' : current;
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
    stateSince: event.at,
    activity: [],
    lastSeen: event.at,
  };
}

/** Every timing field, always present (undefined clears it). */
interface Timing {
  readonly turnStartedAt: number | undefined;
  readonly tool: RunningTool | undefined;
  readonly finishedAt: number | undefined;
  readonly lastTurnMs: number | undefined;
}

/** Turn, tool and finish times after `event`. */
function nextTiming(agent: Agent, event: AgentEvent): Timing {
  const { turnStartedAt, tool, finishedAt, lastTurnMs } = agent;
  const same: Timing = { turnStartedAt, tool, finishedAt, lastTurnMs };
  switch (event.type) {
    case 'start':
      return { ...same, turnStartedAt: undefined, tool: undefined };
    case 'prompt':
      return { ...same, turnStartedAt: turnStartedAt ?? event.at };
    case 'tool': {
      const name = event.toolName ?? 'tool';
      return {
        ...same,
        // Covers a server restart mid-turn: the turn is at least this old.
        turnStartedAt: turnStartedAt ?? event.at,
        tool: { id: event.toolId ?? name, name, since: event.at },
      };
    }
    case 'tool-end': {
      const id = event.toolId ?? event.toolName;
      return tool?.id === id ? { ...same, tool: undefined } : same;
    }
    case 'stop':
      return {
        turnStartedAt: undefined,
        tool: undefined,
        finishedAt: event.at,
        lastTurnMs: turnStartedAt === undefined ? undefined : Math.max(0, event.at - turnStartedAt),
      };
    case 'notify':
    case 'subagent-stop':
    case 'end':
      return same;
  }
}

/** Drops keys whose value is undefined, so optional fields stay absent. */
function defined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/** Pure: returns a new map (or the same instance when nothing changed). */
export function reduce(agents: AgentMap, event: ReducerEvent): AgentMap {
  const existing = agents.get(event.sessionId);

  if (event.type === 'settle') {
    if (existing?.state !== 'done' || existing.lastSeen !== event.since) return agents;
    const next = new Map(agents);
    // Still counts as idle since it finished.
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
  const state = nextState(agent, event);
  // A quick, successful tool call adds no activity line.
  const silent = event.type === 'tool-end' && event.summary === undefined;
  const entry: ActivityEntry = defined({
    at: event.at,
    state,
    summary: event.summary ?? event.type,
    failed: event.failed,
  });
  const next = new Map(agents);
  next.set(
    agent.id,
    defined({
      ...agent,
      ...nextTiming(agent, event),
      state,
      stateSince: state === agent.state ? agent.stateSince : event.at,
      lastSeen: Math.max(agent.lastSeen, event.at),
      activity: silent ? agent.activity : withActivity(agent, entry),
    }),
  );
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
  /**
   * No hook fires while a tool runs (a long build, a test suite), so an agent with a tool
   * in progress is left alone for this long before the usual rules apply.
   */
  readonly toolStaleAfterMs?: number;
}

export const DEFAULT_NEEDS_YOU_REMOVE_MS = 60 * 60_000;
export const DEFAULT_TOOL_STALE_MS = 30 * 60_000;

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
    if (
      agent.tool !== undefined &&
      silentFor < (policy.toolStaleAfterMs ?? DEFAULT_TOOL_STALE_MS)
    ) {
      continue;
    }
    // Finished and quiet since: its answer is waiting for you to read, so keep it as long
    // as an agent waiting on you (it still dozes off as stale meanwhile).
    const awaitingYou = agent.finishedAt !== undefined && agent.finishedAt >= agent.lastSeen;
    const removeAfter = awaitingYou
      ? Math.max(policy.removeAfterMs, policy.needsYouRemoveAfterMs ?? DEFAULT_NEEDS_YOU_REMOVE_MS)
      : policy.removeAfterMs;
    if (silentFor >= removeAfter) {
      next ??= new Map(agents);
      next.delete(agent.id);
    } else if (silentFor >= policy.staleAfterMs && agent.state !== 'stale') {
      next ??= new Map(agents);
      next.set(agent.id, {
        ...agent,
        state: 'stale',
        stateSince: now,
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
