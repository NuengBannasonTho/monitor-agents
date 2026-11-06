import type { Agent } from '@agent-office/shared';
import { describe, expect, it } from 'vitest';
import { justFinished, tabTitle, unseenFinished, waitingOnYou } from './attention';

const agent = (id: string, extra: Partial<Agent> = {}): Agent => ({
  id,
  kind: 'claude-code',
  desk: id,
  cwd: `/w/${id}`,
  state: 'idle',
  stateSince: 0,
  activity: [],
  lastSeen: 0,
  ...extra,
});

describe('attention', () => {
  it('lists agents waiting on you, longest wait first', () => {
    const list = waitingOnYou([
      agent('a', { state: 'needs-you', stateSince: 300 }),
      agent('b', { state: 'working', stateSince: 100 }),
      agent('c', { state: 'needs-you', stateSince: 200 }),
    ]);
    expect(list.map((a) => a.id)).toEqual(['c', 'a']);
  });

  it('flags finishes you have not opened, and only while the agent is not busy again', () => {
    const agents = [
      agent('old', { finishedAt: 50 }), // before tracking started
      agent('seen', { finishedAt: 200 }),
      agent('new', { finishedAt: 300 }),
      agent('busy', { state: 'working', finishedAt: 400 }),
      agent('never'),
    ];
    const list = unseenFinished(agents, { seen: 200 }, 100);
    expect(list.map((a) => a.id)).toEqual(['new']);
  });

  it('reports turns that finished since the last snapshot', () => {
    const first = justFinished(new Map(), [agent('a'), agent('b', { finishedAt: 10 })]);
    expect(first.finished).toEqual([]);
    const second = justFinished(first.current, [
      agent('a', { finishedAt: 20 }),
      agent('b', { finishedAt: 10 }),
      agent('c', { finishedAt: 30 }), // new to us: not announced
    ]);
    expect(second.finished.map((a) => a.id)).toEqual(['a']);
  });

  it('puts the count in the tab title', () => {
    expect(tabTitle(0, 0)).toBe('MON Mangosteen');
    expect(tabTitle(2, 1)).toBe('(2) Needs you – MON Mangosteen');
    expect(tabTitle(0, 3)).toBe('(3) Finished – MON Mangosteen');
  });
});
