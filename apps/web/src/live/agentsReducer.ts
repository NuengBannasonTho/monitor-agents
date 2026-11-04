import type { Agent, ServerMessage } from '@agent-office/shared';

/** Client-side view of the server state, keyed by agent id (insertion order = first seen). */
export type AgentsById = ReadonlyMap<string, Agent>;

export function applyServerMessage(current: AgentsById, message: ServerMessage): AgentsById {
  switch (message.type) {
    case 'snapshot':
      return new Map(message.agents.map((a) => [a.id, a]));
    case 'upsert': {
      const next = new Map(current);
      next.set(message.agent.id, message.agent);
      return next;
    }
    case 'remove': {
      if (!current.has(message.id)) return current;
      const next = new Map(current);
      next.delete(message.id);
      return next;
    }
  }
}

/** Reconnect delay: 0.5 s, 1 s, 2 s, ... capped at 10 s. */
export function backoffMs(attempt: number): number {
  return Math.min(10_000, 500 * 2 ** Math.max(0, attempt));
}
