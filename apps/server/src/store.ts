import type { Agent } from '@agent-office/shared';
import type { AgentMap, ReducerEvent, SweepPolicy } from './reducer.js';
import { DONE_SETTLE_MS, reduce, sweep } from './reducer.js';

export type Change =
  | { readonly type: 'upsert'; readonly agent: Agent }
  | { readonly type: 'remove'; readonly id: string };

type TimerHandle = ReturnType<typeof setTimeout>;
type IntervalHandle = ReturnType<typeof setInterval>;

/** Injectable clock + timers. Tests use vitest fake timers with `realTimers`. */
export interface Timers {
  setTimeout(fn: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
  setInterval(fn: () => void, ms: number): IntervalHandle;
  clearInterval(handle: IntervalHandle): void;
  now(): number;
}

export const realTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => {
    clearTimeout(handle);
  },
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (handle) => {
    clearInterval(handle);
  },
  now: () => Date.now(),
};

/** The sweeper checks every 30 s. */
export const SWEEP_INTERVAL_MS = 30_000;

/**
 * The impure shell around `reduce`: owns the current map, emits per-agent
 * changes, and schedules the synthetic settle event that turns 'done' into 'idle'.
 */
export class AgentStore {
  private agents: AgentMap = new Map();
  private readonly listeners = new Set<(change: Change) => void>();
  private readonly settleTimers = new Map<string, TimerHandle>();
  private sweeper: IntervalHandle | null = null;

  constructor(
    private readonly timers: Timers = realTimers,
    private readonly settleMs: number = DONE_SETTLE_MS,
  ) {}

  snapshot(): Agent[] {
    return [...this.agents.values()];
  }

  get(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  subscribe(listener: (change: Change) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  apply(event: ReducerEvent): void {
    const before = this.agents.get(event.sessionId);
    this.agents = reduce(this.agents, event);
    const after = this.agents.get(event.sessionId);
    if (before === after) return;

    if (after === undefined) {
      this.cancelSettle(event.sessionId);
      this.emit({ type: 'remove', id: event.sessionId });
      return;
    }

    if (after.state === 'done') {
      this.scheduleSettle(after);
    } else {
      this.cancelSettle(after.id);
    }
    this.emit({ type: 'upsert', agent: after });
  }

  /** Applies the stale/remove policy now and emits a change per affected agent. */
  sweep(policy: SweepPolicy): void {
    const before = this.agents;
    const after = sweep(before, this.timers.now(), policy);
    if (after === before) return;
    this.agents = after;
    for (const [id, agent] of before) {
      const next = after.get(id);
      if (next === undefined) {
        this.cancelSettle(id);
        this.emit({ type: 'remove', id });
      } else if (next !== agent) {
        this.emit({ type: 'upsert', agent: next });
      }
    }
  }

  startSweeper(policy: SweepPolicy, intervalMs: number = SWEEP_INTERVAL_MS): void {
    this.stopSweeper();
    this.sweeper = this.timers.setInterval(() => {
      this.sweep(policy);
    }, intervalMs);
  }

  stopSweeper(): void {
    if (this.sweeper !== null) this.timers.clearInterval(this.sweeper);
    this.sweeper = null;
  }

  /** Stops pending timers (used on shutdown and in tests). */
  dispose(): void {
    this.stopSweeper();
    for (const handle of this.settleTimers.values()) this.timers.clearTimeout(handle);
    this.settleTimers.clear();
    this.listeners.clear();
  }

  private scheduleSettle(agent: Agent): void {
    this.cancelSettle(agent.id);
    const since = agent.lastSeen;
    const handle = this.timers.setTimeout(() => {
      this.settleTimers.delete(agent.id);
      this.apply({ type: 'settle', sessionId: agent.id, since, at: this.timers.now() });
    }, this.settleMs);
    this.settleTimers.set(agent.id, handle);
  }

  private cancelSettle(id: string): void {
    const handle = this.settleTimers.get(id);
    if (handle === undefined) return;
    this.timers.clearTimeout(handle);
    this.settleTimers.delete(id);
  }

  private emit(change: Change): void {
    for (const listener of this.listeners) listener(change);
  }
}
