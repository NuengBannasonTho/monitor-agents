import type { Agent } from '@agent-office/shared';
import { describe, expect, it } from 'vitest';
import { applyServerMessage, backoffMs } from './agentsReducer';

const agent = (id: string, state: Agent['state'] = 'idle'): Agent => ({
  id,
  kind: 'claude-code',
  desk: 'desk',
  cwd: '/w/desk',
  state,
  activity: [],
  lastSeen: 1,
});

describe('applyServerMessage', () => {
  it('replaces everything on snapshot', () => {
    const before = new Map([['old', agent('old')]]);
    const after = applyServerMessage(before, {
      type: 'snapshot',
      agents: [agent('a'), agent('b')],
    });
    expect([...after.keys()]).toEqual(['a', 'b']);
  });

  it('upserts in place and keeps order', () => {
    const before = applyServerMessage(new Map(), {
      type: 'snapshot',
      agents: [agent('a'), agent('b')],
    });
    const after = applyServerMessage(before, { type: 'upsert', agent: agent('a', 'working') });
    expect([...after.keys()]).toEqual(['a', 'b']);
    expect(after.get('a')?.state).toBe('working');
  });

  it('removes, and is a no-op for unknown ids', () => {
    const before = new Map([['a', agent('a')]]);
    expect(applyServerMessage(before, { type: 'remove', id: 'zzz' })).toBe(before);
    expect(applyServerMessage(before, { type: 'remove', id: 'a' }).size).toBe(0);
  });
});

describe('backoffMs', () => {
  it('doubles and caps at 10 s', () => {
    expect([0, 1, 2, 3, 10].map(backoffMs)).toEqual([500, 1000, 2000, 4000, 10_000]);
  });
});
