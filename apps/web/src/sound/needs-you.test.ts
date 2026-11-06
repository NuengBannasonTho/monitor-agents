import type { Agent } from '@agent-office/shared';
import { describe, expect, it } from 'vitest';
import { enteredNeedsYou } from './needs-you';

const a = (id: string, state: Agent['state']): Agent => ({
  id,
  kind: 'claude-code',
  desk: 'd',
  cwd: '/d',
  state,
  stateSince: 0,
  activity: [],
  lastSeen: 0,
});

describe('enteredNeedsYou', () => {
  it('reports only agents that newly need you', () => {
    const first = enteredNeedsYou(new Set(), [a('1', 'needs-you'), a('2', 'working')]);
    expect(first.entered).toEqual(['1']);
    const again = enteredNeedsYou(first.current, [a('1', 'needs-you'), a('2', 'needs-you')]);
    expect(again.entered).toEqual(['2']);
    const cleared = enteredNeedsYou(again.current, [a('1', 'working'), a('2', 'needs-you')]);
    expect(cleared.entered).toEqual([]);
    expect(enteredNeedsYou(cleared.current, [a('1', 'needs-you')]).entered).toEqual(['1']);
  });
});
