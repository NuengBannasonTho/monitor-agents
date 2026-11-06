import { zoneOf } from '@agent-office/shared';
import type { Agent } from '@agent-office/shared';

/** Which agents the Agents page lists. */
export type AgentFilter = 'all' | 'needs-you' | 'working' | 'resting';

export function matchesFilter(agent: Agent, filter: AgentFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'needs-you':
      return agent.state === 'needs-you';
    case 'working':
      return zoneOf(agent.state) === 'table' && agent.state !== 'needs-you';
    case 'resting':
      return zoneOf(agent.state) === 'lounge';
  }
}

/** Desk or folder containing every word typed, ignoring case. */
export function matchesSearch(agent: Agent, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = `${agent.desk} ${agent.cwd}`.toLowerCase();
  return words.every((w) => text.includes(w));
}

const rank = (a: Agent): number =>
  a.state === 'needs-you' ? 0 : zoneOf(a.state) === 'table' ? 1 : 2;

/**
 * Who needs you first (longest wait first), then who is working (longest first), then the
 * rest (most recently seen first).
 */
export function sortAgents(agents: readonly Agent[]): Agent[] {
  return [...agents].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (rank(a) === 2 ? b.lastSeen - a.lastSeen : a.stateSince - b.stateSince) ||
      a.desk.localeCompare(b.desk) ||
      a.id.localeCompare(b.id),
  );
}

/** The last two folders of a path: ".../BANNASON/monitor-agents". */
export function shortPath(cwd: string): string {
  const parts = cwd.split(/[\\/]+/).filter(Boolean);
  return parts.length <= 2 ? cwd : `…/${parts.slice(-2).join('/')}`;
}
