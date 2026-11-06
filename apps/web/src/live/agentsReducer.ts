import { ServerMessageSchema } from '@agent-office/shared';
import type { Agent, ServerMessage } from '@agent-office/shared';

/** Client-side view of the server state, keyed by agent id (insertion order = first seen). */
export type AgentsById = ReadonlyMap<string, Agent>;

/** One WebSocket frame as a server message, or null when it is not one (it is then ignored). */
export function parseServerMessage(data: unknown): ServerMessage | null {
  if (typeof data !== 'string') return null;
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    return null;
  }
  const parsed = ServerMessageSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * The agents after one server message. Always a map: useAgentStream keeps the result as
 * state, so anything else would break every render after it.
 */
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
    case 'desktop':
      // Not about agents; useAgentStream keeps it.
      return current;
    default:
      return ignoreUnhandled(message, current);
  }
}

/**
 * `message` is `never` here only while every message type has a case above, so a type added
 * to ServerMessageSchema stops this compiling until it gets one. A bundle built without
 * type-checking ignores such a message, like a malformed one, and keeps the agents.
 */
function ignoreUnhandled(_message: never, current: AgentsById): AgentsById {
  return current;
}

/** Reconnect delay: 0.5 s, 1 s, 2 s, ... capped at 10 s. */
export function backoffMs(attempt: number): number {
  return Math.min(10_000, 500 * 2 ** Math.max(0, attempt));
}
