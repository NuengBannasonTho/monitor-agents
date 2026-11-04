import type { AgentEvent } from '@agent-office/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Coalescer } from './coalescer.js';
import type { Change } from './store.js';
import { AgentStore } from './store.js';

function ev(type: AgentEvent['type'], extra: Partial<AgentEvent> = {}): AgentEvent {
  return { sessionId: 's1', kind: 'claude-code', cwd: '/w/a', type, at: Date.now(), ...extra };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_800_000_000_000);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('AgentStore', () => {
  it('emits upserts and removes', () => {
    const store = new AgentStore();
    const changes: Change[] = [];
    store.subscribe((c) => changes.push(c));
    store.apply(ev('start'));
    store.apply(ev('end'));
    expect(changes.map((c) => c.type)).toEqual(['upsert', 'remove']);
  });

  it('done returns to idle after 3 s via a scheduled settle event', () => {
    const store = new AgentStore();
    store.apply(ev('start'));
    store.apply(ev('stop'));
    expect(store.get('s1')?.state).toBe('done');
    vi.advanceTimersByTime(2_999);
    expect(store.get('s1')?.state).toBe('done');
    vi.advanceTimersByTime(1);
    expect(store.get('s1')?.state).toBe('idle');
  });

  it('a new prompt within 3 s cancels the settle', () => {
    const store = new AgentStore();
    store.apply(ev('start'));
    store.apply(ev('stop'));
    vi.advanceTimersByTime(1_000);
    store.apply(ev('prompt'));
    vi.advanceTimersByTime(5_000);
    expect(store.get('s1')?.state).toBe('called');
  });

  it('dispose clears pending timers', () => {
    const store = new AgentStore();
    store.apply(ev('stop'));
    store.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Coalescer', () => {
  const agentChange = (summary: string): Change => ({
    type: 'upsert',
    agent: {
      id: 's1',
      kind: 'claude-code',
      desk: 'a',
      cwd: '/w/a',
      state: 'working',
      activity: [{ at: 0, state: 'working', summary }],
      lastSeen: 0,
    },
  });

  it('sends at most 10 updates per agent per second, ending with the newest state', () => {
    const sent: string[] = [];
    const c = new Coalescer((m) => {
      if (m.type === 'upsert') sent.push(m.agent.activity[0]?.summary ?? '');
    });
    for (let i = 0; i < 100; i++) {
      c.push(agentChange(`#${i}`));
      vi.advanceTimersByTime(10); // 100 updates over 1 s
    }
    vi.advanceTimersByTime(200);
    expect(sent.length).toBeLessThanOrEqual(11);
    expect(sent.at(-1)).toBe('#99');
  });

  it('sends the first update immediately', () => {
    const send = vi.fn();
    new Coalescer(send).push(agentChange('a'));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('remove is immediate and cancels a pending upsert', () => {
    const types: string[] = [];
    const c = new Coalescer((m) => types.push(m.type));
    c.push(agentChange('a'));
    c.push(agentChange('b')); // pending
    c.push({ type: 'remove', id: 's1' });
    vi.advanceTimersByTime(500);
    expect(types).toEqual(['upsert', 'remove']);
  });

  it('limits per agent, not globally', () => {
    const send = vi.fn();
    const c = new Coalescer(send);
    c.push(agentChange('a'));
    const other = agentChange('b');
    if (other.type === 'upsert') c.push({ type: 'upsert', agent: { ...other.agent, id: 's2' } });
    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe('sweeper', () => {
  const policy = { staleAfterMs: 5 * 60_000, removeAfterMs: 10 * 60_000 };

  it('marks silent agents stale after 5 min and removes them after 10 min', () => {
    const store = new AgentStore();
    const changes: Change[] = [];
    store.subscribe((c) => changes.push(c));
    store.apply(ev('start'));
    store.apply(ev('tool', { toolName: 'Bash' }));
    store.startSweeper(policy);

    vi.advanceTimersByTime(4 * 60_000 + 30_000);
    expect(store.get('s1')?.state).toBe('running');
    vi.advanceTimersByTime(30_000); // 5:00
    expect(store.get('s1')?.state).toBe('stale');
    expect(store.get('s1')?.activity[0]?.summary).toBe('No events for 5 min');

    vi.advanceTimersByTime(5 * 60_000); // 10:00
    expect(store.get('s1')).toBeUndefined();
    expect(changes.at(-1)).toEqual({ type: 'remove', id: 's1' });
    store.dispose();
  });

  it('a new event revives a stale agent and resets its clock', () => {
    const store = new AgentStore();
    store.apply(ev('start'));
    store.startSweeper(policy);
    vi.advanceTimersByTime(6 * 60_000);
    expect(store.get('s1')?.state).toBe('stale');
    store.apply(ev('prompt'));
    expect(store.get('s1')?.state).toBe('called');
    vi.advanceTimersByTime(6 * 60_000);
    expect(store.get('s1')).toBeDefined(); // only 6 min since the prompt
    store.dispose();
  });

  it('does not re-emit for agents that are already stale', () => {
    const store = new AgentStore();
    const changes: Change[] = [];
    store.apply(ev('start'));
    store.startSweeper(policy);
    vi.advanceTimersByTime(5 * 60_000);
    store.subscribe((c) => changes.push(c));
    vi.advanceTimersByTime(2 * 60_000);
    expect(changes).toEqual([]);
    store.dispose();
  });

  it('runs every 30 s and stops on dispose', () => {
    const store = new AgentStore();
    store.startSweeper(policy);
    expect(vi.getTimerCount()).toBe(1);
    store.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps an agent that is waiting on you visible', () => {
    const store = new AgentStore();
    store.apply(ev('start'));
    store.apply(ev('notify'));
    store.startSweeper({ ...policy, needsYouRemoveAfterMs: 60 * 60_000 });
    vi.advanceTimersByTime(30 * 60_000);
    expect(store.get('s1')?.state).toBe('needs-you');
    vi.advanceTimersByTime(30 * 60_000);
    expect(store.get('s1')).toBeUndefined();
    store.dispose();
  });
});
