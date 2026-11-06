import { DEFAULT_PERSONA } from '@agent-office/shared';
import type { Agent } from '@agent-office/shared';
import { describe, expect, it } from 'vitest';
import type { AssistantContext } from './assistant-planner.js';
import { contextData, parsePlan, promptFor } from './assistant-planner.js';

const NOW = Date.UTC(2026, 10, 6, 9, 0);

const agent: Agent = {
  id: 's1',
  kind: 'claude-code',
  desk: 'app',
  cwd: '/code/app',
  state: 'needs-you',
  stateSince: NOW - 5 * 60_000,
  activity: [{ at: NOW, state: 'needs-you', summary: 'Wants to run pnpm test' }],
  terminal: 'term-1',
  lastSeen: NOW,
};

const context: AssistantContext = {
  orca: true,
  repos: [{ id: 'r1', name: 'app', path: '/code/app' }],
  worktrees: [],
  agents: [agent, { ...agent, id: 'c1', kind: 'codex', terminal: undefined }],
  customAgents: [{ name: 'reviewer', description: 'Reviews\n code', scope: 'yours' }],
  usageToday: null,
  account: null,
  now: NOW,
};

describe('parsePlan', () => {
  it('drops only the actions it cannot read', () => {
    const plan = parsePlan({
      reply: 'Sure',
      matches: ['r1'],
      actions: [
        { type: 'theme', theme: 'dark' },
        { type: 'theme', theme: 'purple' },
        { type: 'launch-rockets' },
        { type: 'switch', setting: 'sound', on: true },
      ],
    });
    expect(plan.actions).toEqual([
      { type: 'theme', theme: 'dark' },
      { type: 'switch', setting: 'sound', on: true },
    ]);
  });

  it('refuses an answer without a reply', () => {
    expect(() => parsePlan({ reply: ' ', matches: [], actions: [] })).toThrow();
  });
});

describe('the prompt', () => {
  it('tells which agents can be typed to and how long they have waited', () => {
    const data = contextData(context) as { agents: Record<string, unknown>[] };
    expect(data.agents[0]).toMatchObject({
      id: 's1',
      name: 'app',
      state: 'needs-you',
      minutesInState: 5,
      canType: true,
      recentSteps: ['Wants to run pnpm test'],
    });
    expect(data.agents[1]).toMatchObject({ id: 'c1', canType: false });
  });

  it('speaks in the chosen personality', () => {
    const prompt = promptFor(
      {
        message: 'hi',
        history: [],
        persona: { ...DEFAULT_PERSONA, style: 'pro', voice: 'ka', callMe: 'บอส', emoji: true },
      },
      context,
    );
    expect(prompt).toContain('You are MON MANG');
    expect(prompt).toContain('A professional coordinator');
    expect(prompt).toContain('ค่ะ');
    expect(prompt).toContain('Address the user as "บอส"');
    expect(prompt).toContain('Use a few fitting emoji.');
    expect(prompt).toContain('"description":"Reviews code"');
  });
});
