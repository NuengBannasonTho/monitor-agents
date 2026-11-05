import { describe, expect, it } from 'vitest';
import { AGENT_STATES, ServerMessageSchema } from './domain.js';
import { deskFromCwd, zoneOf } from './zones.js';

describe('zoneOf', () => {
  it('puts active states at the table and the rest in the lounge', () => {
    const table = AGENT_STATES.filter((s) => zoneOf(s) === 'table');
    expect(table).toEqual(['called', 'working', 'reading', 'running', 'needs-you']);
    expect(zoneOf('idle')).toBe('lounge');
    expect(zoneOf('done')).toBe('lounge');
    expect(zoneOf('stale')).toBe('lounge');
  });
});

describe('deskFromCwd', () => {
  it.each([
    ['/Users/me/orca/worktrees/feat-auth', 'feat-auth'],
    ['/Users/me/orca/worktrees/feat-auth/', 'feat-auth'],
    ['C:\\work\\fix-tests', 'fix-tests'],
    ['relative', 'relative'],
    ['', 'unknown'],
  ])('%s -> %s', (cwd, desk) => {
    expect(deskFromCwd(cwd)).toBe(desk);
  });
});

describe('ServerMessageSchema', () => {
  it('rejects unknown message types', () => {
    expect(ServerMessageSchema.safeParse({ type: 'nope' }).success).toBe(false);
  });
  it('accepts a remove message', () => {
    expect(ServerMessageSchema.parse({ type: 'remove', id: 'a' })).toEqual({
      type: 'remove',
      id: 'a',
    });
  });
});

describe('AgentSchema', () => {
  it('accepts agents from a server that predates stateSince', () => {
    const parsed = ServerMessageSchema.parse({
      type: 'upsert',
      agent: {
        id: 'a',
        kind: 'claude-code',
        desk: 'd',
        cwd: '/d',
        state: 'idle',
        activity: [],
        lastSeen: 42,
      },
    });
    expect(parsed.type === 'upsert' && parsed.agent.stateSince).toBe(42);
  });
});
