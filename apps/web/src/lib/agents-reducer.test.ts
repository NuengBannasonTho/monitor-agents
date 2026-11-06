import type { Agent, ServerMessage } from '@agent-office/shared';
import { describe, expect, it } from 'vitest';
import type { AgentsById } from './agents-reducer';
import { applyServerMessage, backoffMs, parseServerMessage } from './agents-reducer';

const agent = (id: string, state: Agent['state'] = 'idle'): Agent => ({
  id,
  kind: 'claude-code',
  desk: 'desk',
  cwd: '/w/desk',
  state,
  stateSince: 1,
  activity: [],
  lastSeen: 1,
});

const withSubagent = (id: string): Agent => ({
  ...agent(id, 'working'),
  subagents: [{ id: `${id}-sub`, type: 'Explore', state: 'reading', since: 1, lastSeen: 1 }],
});

/** One of every message the server sends: a type added to the schema must be added here too. */
const ONE_OF_EACH: { readonly [T in ServerMessage['type']]: Extract<ServerMessage, { type: T }> } =
  {
    snapshot: { type: 'snapshot', agents: [agent('a')] },
    upsert: { type: 'upsert', agent: agent('b') },
    remove: { type: 'remove', id: 'a' },
    desktop: { type: 'desktop', desktop: { walkers: true, hidden: ['b'], connected: false } },
  };

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

  // The state useAgentStream keeps must never become undefined, or its next render throws.
  it.each(Object.values(ONE_OF_EACH))('returns a map for a $type message', (message) => {
    expect(applyServerMessage(new Map([['a', agent('a')]]), message)).toBeInstanceOf(Map);
  });

  it('leaves the agents and their subagents alone on a desktop status', () => {
    const before = new Map([['a', withSubagent('a')]]);
    expect(applyServerMessage(before, ONE_OF_EACH.desktop)).toBe(before);
  });
});

describe('parseServerMessage', () => {
  it('reads a frame the server sent', () => {
    expect(parseServerMessage(JSON.stringify(ONE_OF_EACH.desktop))).toEqual(ONE_OF_EACH.desktop);
  });

  it('ignores binary frames, broken JSON and unknown message types', () => {
    expect(parseServerMessage(new ArrayBuffer(4))).toBeNull();
    expect(parseServerMessage('{not json')).toBeNull();
    expect(parseServerMessage(JSON.stringify({ type: 'nope' }))).toBeNull();
  });
});

describe('the frames a dashboard gets on connect', () => {
  // Regression: the server follows the snapshot with its desktop status. The reducer once had
  // no case for that, returned undefined, and `byId.values()` in useAgentStream threw.
  it('keep every agent and subagent', () => {
    const frames = [
      { type: 'snapshot', agents: [withSubagent('a'), agent('b')] },
      { type: 'desktop', desktop: { walkers: true, connected: false } },
      { type: 'upsert', agent: agent('b', 'needs-you') },
      { type: 'desktop', desktop: { walkers: false, connected: true } },
    ].map((message) => JSON.stringify(message));

    let byId: AgentsById = new Map();
    for (const frame of frames) {
      const message = parseServerMessage(frame);
      expect(message).not.toBeNull();
      if (message !== null) byId = applyServerMessage(byId, message);
    }

    const agents = [...byId.values()];
    expect(agents.map((a) => [a.id, a.state])).toEqual([
      ['a', 'working'],
      ['b', 'needs-you'],
    ]);
    expect(agents[0]?.subagents?.map((s) => s.id)).toEqual(['a-sub']);
  });
});

describe('backoffMs', () => {
  it('doubles and caps at 10 s', () => {
    expect([0, 1, 2, 3, 10].map(backoffMs)).toEqual([500, 1000, 2000, 4000, 10_000]);
  });
});
