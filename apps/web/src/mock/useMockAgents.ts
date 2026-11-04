import type { Agent } from '@agent-office/shared';
import { useEffect, useState } from 'react';
import { MockSimulator } from './simulator';

const TICK_MS = 250;
const DEFAULT_AGENTS = 6;
const MAX_AGENTS = 40;

/**
 * `?agents=N` (or `#agents-N`, for hosts that only pass a hash) lets you stress
 * the seat rings without changing code.
 */
export function mockAgentCountFromUrl(search: string, hash = ''): number {
  const fromHash = /^#agents-(\d+)$/.exec(hash)?.[1];
  const raw = fromHash ?? new URLSearchParams(search).get('agents');
  const n = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return DEFAULT_AGENTS;
  return Math.min(MAX_AGENTS, Math.max(0, n));
}

/** In-browser simulator, used only for the static preview (no server). */
export function useMockAgents(count: number, enabled: boolean): readonly Agent[] {
  const [sim] = useState(() => new MockSimulator(enabled ? count : 0, Date.now()));
  const [agents, setAgents] = useState<readonly Agent[]>(() => sim.agents());

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      if (sim.tick(Date.now())) setAgents(sim.agents());
    }, TICK_MS);
    return () => {
      clearInterval(id);
    };
  }, [sim, enabled]);

  return agents;
}
