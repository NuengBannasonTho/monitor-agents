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

describe('reduce timing', () => {
  const agent = (m: AgentMap) => m.get('s1');

  it('records when each state began', () => {
    const start = ev('start');
    const prompt = ev('prompt');
    const read1 = ev('tool', { toolName: 'Read' });
    const read2 = ev('tool', { toolName: 'Grep' });
    const m = run(start, prompt, read1, read2);
    // Still reading: the clock keeps the first Read.
    expect(agent(m)?.stateSince).toBe(read1.at);
  });

  it('times the turn from your prompt to the stop', () => {
    const prompt = ev('prompt');
    const stop = ev('stop');
    const m = run(ev('start'), prompt, ev('tool', { toolName: 'Edit' }), stop);
    expect(agent(m)).toMatchObject({ finishedAt: stop.at, lastTurnMs: stop.at - prompt.at });
    expect(agent(m)?.turnStartedAt).toBeUndefined();
    expect(agent(m)?.tool).toBeUndefined();
  });

  it('keeps the turn start when another prompt arrives mid-turn', () => {
    const first = ev('prompt');
    const m = run(ev('start'), first, ev('tool', { toolName: 'Bash' }), ev('prompt'));
    expect(agent(m)?.turnStartedAt).toBe(first.at);
  });

  it('tracks the tool in progress until it ends', () => {
    const bash = ev('tool', { toolName: 'Bash', toolId: 't1' });
    const running = run(ev('start'), ev('prompt'), bash);
    expect(agent(running)?.tool).toEqual({ id: 't1', name: 'Bash', since: bash.at });
    const ended = reduce(running, ev('tool-end', { toolName: 'Bash', toolId: 't1' }));
    expect(agent(ended)?.tool).toBeUndefined();
    // Another tool's end does not clear it.
    const other = reduce(running, ev('tool-end', { toolName: 'Read', toolId: 't0' }));
    expect(agent(other)?.tool?.id).toBe('t1');
  });

  it('a quick tool end adds no activity line; a failure does', () => {
    const base = run(ev('start'), ev('prompt'), ev('tool', { toolName: 'Bash', toolId: 't1' }));
    const quick = reduce(base, ev('tool-end', { toolName: 'Bash', toolId: 't1' }));
    expect(agent(quick)?.activity).toHaveLength(agent(base)?.activity.length ?? 0);
    const failed = reduce(
      base,
      ev('tool-end', { toolName: 'Bash', toolId: 't1', failed: true, summary: 'Bash failed' }),
    );
    expect(agent(failed)?.activity[0]).toMatchObject({ summary: 'Bash failed', failed: true });
  });

  it('leaves needs-you once the tool that asked for permission has run', () => {
    const base = run(
      ev('start'),
      ev('prompt'),
      ev('tool', { toolName: 'Bash', toolId: 't2' }),
      ev('notify', { summary: 'Needs permission' }),
    );
    expect(stateOf(reduce(base, ev('tool-end', { toolName: 'Read', toolId: 't1' })))).toBe(
      'needs-you',
    );
    expect(stateOf(reduce(base, ev('tool-end', { toolName: 'Bash', toolId: 't2' })))).toBe(
      'working',
    );
  });
});
