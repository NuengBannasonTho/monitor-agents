import { MAX_ACTIVITY, MAX_DETAIL_PARTS, MAX_SUBAGENTS, deskFromCwd } from '@agent-office/shared';
import type {
  ActivityEntry,
  Agent,
  AgentEvent,
  AgentState,
  RunningTool,
  Subagent,
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
  // A subagent's own steps show at its desk; the main agent keeps what it was doing (it is
  // waiting on the subagent), unless it had been written off as stale.
  if (event.subagentId !== undefined && (event.type === 'tool' || event.type === 'tool-end')) {
    return current === 'stale' ? 'working' : current;
  }
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
    case 'interrupt':
      // The turn was cut short: back to waiting for you.
      return 'idle';
    case 'subagent-start':
    case 'subagent-stop':
      // A subagent starting or finishing does not change what the main agent is doing.
      return current === 'stale' || current === 'idle' ? 'working' : current;
    case 'end':
      return current;
  }
}

function withActivity(activity: Agent['activity'], entry: ActivityEntry): Agent['activity'] {
  return [entry, ...activity].slice(0, MAX_ACTIVITY);
}

/**
 * A tool call's end adds its result (output, duration, error) to the line of the call
 * itself, so a command and what it printed open together.
 */
function withResult(activity: Agent['activity'], event: AgentEvent): Agent['activity'] {
  if (event.type !== 'tool-end' || event.toolId === undefined) return activity;
  const i = activity.findIndex((e) => e.toolId === event.toolId);
  const call = activity[i];
  if (call === undefined) return activity;
  const detail = [...(call.detail ?? []), ...(event.detail ?? [])].slice(0, MAX_DETAIL_PARTS);
  const ended: ActivityEntry = defined({
    ...call,
    detail: detail.length === 0 ? undefined : detail,
    failed: event.failed ?? call.failed,
    // Matched once; the id has done its job.
    toolId: undefined,
  });
  return activity.map((e, j) => (j === i ? ended : e));
}

/** "Read a.ts (subagent Explore)" -> "Read a.ts": the desk already says whose it is. */
function withoutSubagentSuffix(summary: string): string {
  return summary.replace(/ \(subagent[^)]*\)$/, '');
}

/** The agent's subagents after `event`: one starts, works, or finishes. */
function nextSubagents(agent: Agent, event: AgentEvent): Agent['subagents'] {
  const list = agent.subagents ?? [];
  const id = event.subagentId;
  if (id === undefined) return agent.subagents;
  if (event.type === 'subagent-stop') {
    const rest = list.filter((s) => s.id !== id);
    return rest.length === 0 ? undefined : rest;
  }
  const existing = list.find((s) => s.id === id);
  // Without the SubagentStart hook, the first step is the first sight of it.
  const base: Subagent = existing ?? {
    id,
    type: event.subagentType ?? 'subagent',
    state: 'called',
    since: event.at,
    lastSeen: event.at,
  };
  const updated: Subagent = {
    ...base,
    lastSeen: Math.max(base.lastSeen, event.at),
    ...(event.type === 'tool'
      ? {
          state: stateForTool(event.toolName ?? ''),
          ...(event.summary === undefined ? {} : { summary: withoutSubagentSuffix(event.summary) }),
        }
      : {}),
  };
  // Each keeps its place in the list (and so its desk); newcomers join the end, and past
  // the limit the oldest make way.
  return existing === undefined
    ? [...list, updated].slice(-MAX_SUBAGENTS)
    : list.map((s) => (s.id === id ? updated : s));
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
  // The main agent's own tool and turn are not a subagent's.
  if (event.subagentId !== undefined) return same;
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
    case 'interrupt':
      return { ...same, turnStartedAt: undefined, tool: undefined };
    case 'notify':
    case 'subagent-start':
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
    toolId: event.type === 'tool' ? event.toolId : undefined,
    detail: event.detail,
  });
  const activity = withResult(agent.activity, event);
  const next = new Map(agents);
  next.set(
    agent.id,
    defined({
      ...agent,
      ...nextTiming(agent, event),
      state,
      stateSince: state === agent.state ? agent.stateSince : event.at,
      lastSeen: Math.max(agent.lastSeen, event.at),
      activity: silent ? activity : withActivity(activity, entry),
      // Stopping the turn stops its subagents too.
      subagents: event.type === 'interrupt' ? undefined : nextSubagents(agent, event),
      // The Orca terminal it runs in, as last reported (sessions can move).
      terminal: event.terminal ?? agent.terminal,
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
  for (const listed of agents.values()) {
    // A subagent silent this long missed its SubagentStop (crashed, killed): let it go.
    const subagents = listed.subagents?.filter((s) => now - s.lastSeen < policy.removeAfterMs);
    let agent = listed;
    if (subagents !== undefined && subagents.length !== listed.subagents?.length) {
      agent = defined({ ...listed, subagents: subagents.length === 0 ? undefined : subagents });
      next ??= new Map(agents);
      next.set(agent.id, agent);
    }
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
        activity: withActivity(agent.activity, {
          at: now,
          state: 'stale',
          summary: `No events for ${minutes(policy.staleAfterMs)}`,
        }),
      });
    }
  }
  return next ?? agents;
}
