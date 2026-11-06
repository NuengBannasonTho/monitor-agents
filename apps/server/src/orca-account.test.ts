import { describe, expect, it } from 'vitest';
import { accountStatusFrom } from './orca-account.js';

const reply = {
  ok: true,
  result: {
    claude: {
      accounts: [
        {
          id: 'acc-1',
          email: 'me@example.com',
          organizationName: "me@example.com's Organization",
          accessToken: 'never-copied',
        },
      ],
      activeAccountId: 'acc-1',
      systemDefaultEmail: 'work@example.com',
    },
    rateLimits: {
      claude: {
        session: { usedPercent: 25, windowMinutes: 300, resetsAt: 1, resetDescription: '2:20 PM' },
        weekly: {
          usedPercent: 4,
          windowMinutes: 10080,
          resetsAt: 2,
          resetDescription: 'Fri 9:00 AM',
        },
        updatedAt: 3,
        error: null,
      },
    },
  },
};

describe('the account from Orca', () => {
  it('lists the Orca account and the default login, the active one marked', () => {
    const status = accountStatusFrom(reply);
    expect(status.accounts).toEqual([
      {
        id: 'acc-1',
        email: 'me@example.com',
        organization: "me@example.com's Organization",
        kind: 'orca',
        active: true,
      },
      {
        id: 'system',
        email: 'work@example.com',
        organization: null,
        kind: 'system',
        active: false,
      },
    ]);
    expect(JSON.stringify(status)).not.toContain('never-copied');
  });

  it('reads the session and weekly usage', () => {
    const { usage } = accountStatusFrom(reply);
    expect(usage.session).toEqual({
      usedPercent: 25,
      windowMinutes: 300,
      resetsAt: 1,
      resets: '2:20 PM',
    });
    expect(usage.weekly?.usedPercent).toBe(4);
  });

  it('has nothing to say when Orca refused or sent something else', () => {
    expect(accountStatusFrom({ ok: false }).reachable).toBe(false);
    expect(accountStatusFrom(null).accounts).toEqual([]);
  });
});
