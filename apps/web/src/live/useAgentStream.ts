import type { Agent, DesktopStatus } from '@agent-office/shared';
import { useEffect, useMemo, useState } from 'react';
import type { AgentsById } from './agentsReducer';
import { applyServerMessage, backoffMs, parseServerMessage } from './agentsReducer';

export type StreamStatus = 'connecting' | 'live' | 'offline';

export interface AgentStream {
  readonly agents: readonly Agent[];
  readonly status: StreamStatus;
  /** The desktop app setting and whether it runs; null until the server says (or an old server). */
  readonly desktop: DesktopStatus | null;
}

/** `desktop` marks the connection as the desktop app's own page. */
function socketUrl(client?: 'desktop'): string {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const query = client === undefined ? '' : `?client=${client}`;
  return `${scheme}://${window.location.host}/ws${query}`;
}

/**
 * Live agents from the server: a snapshot on connect, then deltas. Messages are
 * validated with zod; anything malformed is ignored. Reconnects with backoff.
 */
export function useAgentStream(enabled: boolean, client?: 'desktop'): AgentStream {
  const [byId, setById] = useState<AgentsById>(() => new Map());
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const [desktop, setDesktop] = useState<DesktopStatus | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let disposed = false;

    const connect = (): void => {
      setStatus('connecting');
      socket = new WebSocket(socketUrl(client));
      socket.addEventListener('open', () => {
        attempt = 0;
        setStatus('live');
      });
      socket.addEventListener('message', (event: MessageEvent<unknown>) => {
        const message = parseServerMessage(event.data);
        if (message === null) return;
        if (message.type === 'desktop') setDesktop(message.desktop);
        else setById((current) => applyServerMessage(current, message));
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
  }, [enabled, client]);

  const agents = useMemo(() => [...byId.values()], [byId]);
  return { agents, status, desktop };
}
