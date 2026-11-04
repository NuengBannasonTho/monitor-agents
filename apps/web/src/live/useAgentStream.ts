import { ServerMessageSchema } from '@agent-office/shared';
import type { Agent } from '@agent-office/shared';
import { useEffect, useMemo, useState } from 'react';
import type { AgentsById } from './agentsReducer';
import { applyServerMessage, backoffMs } from './agentsReducer';

export type StreamStatus = 'connecting' | 'live' | 'offline';

export interface AgentStream {
  readonly agents: readonly Agent[];
  readonly status: StreamStatus;
}

function socketUrl(): string {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}/ws`;
}

/**
 * Live agents from the server: a snapshot on connect, then deltas. Messages are
 * validated with zod; anything malformed is ignored. Reconnects with backoff.
 */
export function useAgentStream(enabled: boolean): AgentStream {
  const [byId, setById] = useState<AgentsById>(() => new Map());
  const [status, setStatus] = useState<StreamStatus>('connecting');

  useEffect(() => {
    if (!enabled) return;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let disposed = false;

    const connect = (): void => {
      setStatus('connecting');
      socket = new WebSocket(socketUrl());
      socket.addEventListener('open', () => {
        attempt = 0;
        setStatus('live');
      });
      socket.addEventListener('message', (event: MessageEvent<unknown>) => {
        if (typeof event.data !== 'string') return;
        let raw: unknown;
        try {
          raw = JSON.parse(event.data);
        } catch {
          return;
        }
        const parsed = ServerMessageSchema.safeParse(raw);
        if (!parsed.success) return;
        setById((current) => applyServerMessage(current, parsed.data));
      });
      socket.addEventListener('close', () => {
        if (disposed) return;
        setStatus('offline');
        retryTimer = setTimeout(connect, backoffMs(attempt));
        attempt += 1;
      });
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimer !== undefined) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [enabled]);

  const agents = useMemo(() => [...byId.values()], [byId]);
  return { agents, status };
}
