import type { AgentEvent, AgentKind } from '@agent-office/shared';

/**
 * Turns one agent's raw hook payload into a normalized AgentEvent.
 * Must never throw: anything it does not understand returns null.
 */
export interface Adapter {
  readonly kind: AgentKind;
  normalize(raw: unknown): AgentEvent | null;
}

export type Clock = () => number;
