import type { Agent, ServerMessage } from '@agent-office/shared';
import type { Change, Timers } from './store.js';
import { realTimers } from './store.js';

/** At most 10 messages per agent per second. */
export const MIN_INTERVAL_MS = 100;

interface Slot {
  lastSentAt: number;
  pending: Agent | null;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Per-agent rate limiter for outgoing deltas. The first update in a window goes
 * out immediately; later ones collapse into one trailing message carrying the
 * newest state. Removes are never delayed and cancel any pending upsert.
 */
export class Coalescer {
  private readonly slots = new Map<string, Slot>();

  constructor(
    private readonly send: (message: ServerMessage) => void,
    private readonly timers: Timers = realTimers,
    private readonly intervalMs: number = MIN_INTERVAL_MS,
  ) {}

  push(change: Change): void {
    if (change.type === 'remove') {
      this.drop(change.id);
      this.send({ type: 'remove', id: change.id });
      return;
    }

    const { agent } = change;
    const now = this.timers.now();
    const slot = this.slots.get(agent.id) ?? { lastSentAt: -Infinity, pending: null, timer: null };
    this.slots.set(agent.id, slot);

    if (slot.timer === null && now - slot.lastSentAt >= this.intervalMs) {
      slot.lastSentAt = now;
      this.send({ type: 'upsert', agent });
      return;
    }

    slot.pending = agent;
    if (slot.timer !== null) return;
    const wait = Math.max(0, slot.lastSentAt + this.intervalMs - now);
    slot.timer = this.timers.setTimeout(() => {
      slot.timer = null;
      const latest = slot.pending;
      slot.pending = null;
      if (latest === null) return;
      slot.lastSentAt = this.timers.now();
      this.send({ type: 'upsert', agent: latest });
    }, wait);
  }

  dispose(): void {
    for (const id of [...this.slots.keys()]) this.drop(id);
  }

  private drop(id: string): void {
    const slot = this.slots.get(id);
    if (slot?.timer != null) this.timers.clearTimeout(slot.timer);
    this.slots.delete(id);
  }
}
