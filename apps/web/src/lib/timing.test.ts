import type { Agent } from '@agent-office/shared';
import { describe, expect, it } from 'vitest';
import { tagTimerStart, timingLines } from './timing';

const MIN = 60_000;
const agent = (extra: Partial<Agent>): Agent => ({
  id: 'a',
  kind: 'claude-code',
  desk: 'a',
  cwd: '/w/a',
  state: 'idle',
  stateSince: 0,
  activity: [],
  lastSeen: 0,
  ...extra,
});

describe('timing', () => {
  const now = 30 * MIN;

  it('says how long the agent has waited on you', () => {
    const a = agent({ state: 'needs-you', stateSince: now - 4 * MIN });
    expect(timingLines(a, now)).toEqual(['Waiting on you for 4 min']);
    expect(tagTimerStart(a, now)).toBe(now - 4 * MIN);
  });

  it('times a long tool call and the whole turn', () => {
    const a = agent({
      state: 'running',
      turnStartedAt: now - 12 * MIN,
      tool: { id: 't', name: 'Bash', since: now - 3 * MIN },
    });
    expect(timingLines(a, now)).toEqual(['Bash running for 3 min', 'On your prompt for 12 min']);
    expect(tagTimerStart(a, now)).toBe(now - 3 * MIN);
    const quick = { ...a, tool: { id: 't', name: 'Read', since: now - 2_000 } };
    expect(timingLines(quick, now)).toEqual(['On your prompt for 12 min']);
    expect(tagTimerStart(quick, now)).toBeNull();
  });

  it('reports the last finish once the agent is back in the forest', () => {
    const a = agent({ state: 'idle', finishedAt: now - 2 * MIN, lastTurnMs: 8 * MIN });
    expect(timingLines(a, now)).toEqual(['Finished 2m ago, took 8 min']);
    expect(timingLines(agent({ state: 'idle', stateSince: now - 20 * MIN }), now)).toEqual([
      'Idle for 20 min',
    ]);
  });
});
