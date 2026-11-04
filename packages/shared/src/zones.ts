import type { AgentState } from './domain.js';

export type Zone = 'table' | 'lounge';

/** States that sit at the meeting table; everything else floats in the lounge. */
const TABLE_STATES: ReadonlySet<AgentState> = new Set<AgentState>([
  'called',
  'working',
  'reading',
  'running',
  'needs-you',
]);

export function zoneOf(state: AgentState): Zone {
  return TABLE_STATES.has(state) ? 'table' : 'lounge';
}

/** Last path segment of a cwd, used as the "desk" (worktree folder) name. */
export function deskFromCwd(cwd: string): string {
  const trimmed = cwd.replace(/[\\/]+$/, '');
  const segments = trimmed.split(/[\\/]/);
  const last = segments[segments.length - 1];
  return last === undefined || last === '' ? cwd || 'unknown' : last;
}
