import { MAX_ACTIVITY } from '@agent-office/shared';
import type { AgentEvent } from '@agent-office/shared';
import { describe, expect, it } from 'vitest';
import type { AgentMap } from './reducer.js';
import { reduce } from './reducer.js';

let clock = 1_000;
function ev(type: AgentEvent['type'], extra: Partial<AgentEvent> = {}): AgentEvent {
  clock += 10;
  return { sessionId: 's1', kind: 'claude-code', cwd: '/w/feat-auth', type, at: clock, ...extra };
}

function run(...events: AgentEvent[]): AgentMap {
  return events.reduce<AgentMap>((m, e) => reduce(m, e), new Map());
}

const stateOf = (m: AgentMap): string | undefined => m.get('s1')?.state;

describe('reduce transitions', () => {
  it('start -> idle, with desk from the cwd', () => {
    const m = run(ev('start', { summary: 'Session started' }));
    expect(m.get('s1')).toMatchObject({ state: 'idle', desk: 'feat-auth', kind: 'claude-code' });
  });

  it('prompt -> called', () => {
    expect(stateOf(run(ev('start'), ev('prompt')))).toBe('called');
  });

  it.each([
    ['Read', 'reading'],
    ['Grep', 'reading'],
    ['Glob', 'reading'],
    ['Bash', 'running'],
    ['Edit', 'working'],
    ['Agent', 'working'],
  ])('tool %s -> %s', (toolName, state) => {
    expect(stateOf(run(ev('start'), ev('prompt'), ev('tool', { toolName })))).toBe(state);
  });

  it('notify -> needs-you, then the next tool clears it', () => {
    const waiting = run(ev('start'), ev('tool', { toolName: 'Bash' }), ev('notify'));
    expect(stateOf(waiting)).toBe('needs-you');
    expect(stateOf(reduce(waiting, ev('tool', { toolName: 'Bash' })))).toBe('running');
  });

  it('stop -> done', () => {
    expect(stateOf(run(ev('start'), ev('prompt'), ev('stop')))).toBe('done');
  });

  it('subagent-stop keeps the main agent busy', () => {
    expect(stateOf(run(ev('start'), ev('tool', { toolName: 'Read' }), ev('subagent-stop')))).toBe(
      'reading',
    );
    expect(stateOf(run(ev('start'), ev('subagent-stop')))).toBe('working');
  });

  it('end removes the agent', () => {
    const m = run(ev('start'), ev('prompt'), ev('end'));
    expect(m.has('s1')).toBe(false);
  });

  it('end for an unknown session is a no-op returning the same map', () => {
    const m: AgentMap = new Map();
    expect(reduce(m, ev('end'))).toBe(m);
  });

  it('creates unknown sessions on the fly (server restarted mid-session)', () => {
    expect(stateOf(run(ev('tool', { toolName: 'Bash' })))).toBe('running');
  });

  it('settle moves done -> idle only if nothing happened since', () => {
    const done = run(ev('start'), ev('stop'));
    const since = done.get('s1')?.lastSeen ?? -1;
    expect(
      stateOf(reduce(done, { type: 'settle', sessionId: 's1', since, at: since + 3000 })),
    ).toBe('idle');

    const busyAgain = reduce(done, ev('prompt'));
    expect(reduce(busyAgain, { type: 'settle', sessionId: 's1', since, at: since + 3000 })).toBe(
      busyAgain,
    );
  });

  it('settle for a non-done agent returns the same map', () => {
    const m = run(ev('start'), ev('prompt'));
    expect(reduce(m, { type: 'settle', sessionId: 's1', since: 0, at: 0 })).toBe(m);
  });

  it('is pure: never mutates its input', () => {
    const before = run(ev('start'));
    const snapshot = JSON.stringify([...before]);
    reduce(before, ev('prompt'));
    expect(JSON.stringify([...before])).toBe(snapshot);
  });

  it('keeps the desk fixed even if the cwd changes later', () => {
    const m = run(ev('start'), ev('tool', { toolName: 'Bash', cwd: '/w/feat-auth/packages/api' }));
    expect(m.get('s1')?.desk).toBe('feat-auth');
  });

  it(`caps activity at ${MAX_ACTIVITY}, newest first`, () => {
    const events = [
      ev('start'),
      ...Array.from({ length: 30 }, (_, i) => ev('tool', { toolName: 'Read', summary: `#${i}` })),
    ];
    const activity = run(...events).get('s1')?.activity ?? [];
    expect(activity).toHaveLength(MAX_ACTIVITY);
    expect(activity[0]?.summary).toBe('#29');
  });

  it('tracks agents independently', () => {
    const m = run(ev('start'), ev('start', { sessionId: 's2' }), ev('prompt', { sessionId: 's2' }));
    expect(m.get('s1')?.state).toBe('idle');
    expect(m.get('s2')?.state).toBe('called');
  });
});
