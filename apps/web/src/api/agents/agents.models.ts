import type { Agent, DesktopStatus } from '@agent-office/shared';

/** The WebSocket to the server: connecting, live, or gone (it retries). */
export type StreamStatus = 'connecting' | 'live' | 'offline';

export interface AgentStream {
  readonly agents: readonly Agent[];
  readonly status: StreamStatus;
  /** The desktop app setting and whether it runs; null until the server says (or an old server). */
  readonly desktop: DesktopStatus | null;
}

/** Typing to an agent, or stopping it: done, or why not. */
export type SendResult = { readonly ok: true } | { readonly ok: false; readonly error: string };
