import type { Agent, AgentState } from '@agent-office/shared';
import { describe, expect, it } from 'vitest';
import { matchesFilter, matchesSearch, shortPath, sortAgents } from './agent-list';

const agent = (
  id: string,
  state: AgentState,
  stateSince: number,
  lastSeen = stateSince,
): Agent => ({
  id,
  kind: 'claude-code',
  desk: id,
  cwd: `/Users/me/code/${id}`,
  state,
  stateSince,
  lastSeen,
  activity: [],
});

describe('the Agents page list', () => {
  it('puts who needs you first, then who works, then the rest by last seen', () => {
    const list = sortAgents([
      agent('idle-old', 'idle', 1, 10),
      agent('working-new', 'working', 50),
      agent('waiting', 'needs-you', 40),
      agent('idle-new', 'done', 2, 90),
      agent('working-old', 'running', 20),
    ]);
    expect(list.map((a) => a.id)).toEqual([
      'waiting',
      'working-old',
      'working-new',
      'idle-new',
      'idle-old',
    ]);
  });

  it('filters by what they are doing and searches desk and folder', () => {
    expect(matchesFilter(agent('a', 'needs-you', 1), 'working')).toBe(false);
    expect(matchesFilter(agent('a', 'reading', 1), 'working')).toBe(true);
    expect(matchesFilter(agent('a', 'stale', 1), 'resting')).toBe(true);
    expect(matchesSearch(agent('feat-auth', 'idle', 1), 'CODE auth')).toBe(true);
    expect(matchesSearch(agent('feat-auth', 'idle', 1), 'billing')).toBe(false);
  });

  it('shortens a folder to its last two parts', () => {
    expect(shortPath('/Users/me/Desktop/BANNASON/monitor-agents')).toBe(
      '…/BANNASON/monitor-agents',
    );
    expect(shortPath('/tmp/x')).toBe('/tmp/x');
  });
});
