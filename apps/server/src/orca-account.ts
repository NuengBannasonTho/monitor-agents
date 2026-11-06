import type { AccountStatus, ClaudeAccount, UsageWindow } from '@agent-office/shared';
import { NO_ACCOUNT } from '@agent-office/shared';
import { defaultOrcaBin, record, runOrca } from './orca-terminal.js';

/*
 * The Claude account and its usage, from `orca account list --json`. Only the fields below
 * are copied out; Orca's reply never reaches the browser as it is.
 */

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function usageWindow(value: unknown): UsageWindow | null {
  const w = record(value);
  const usedPercent = num(w.usedPercent);
  if (usedPercent === null) return null;
  return {
    usedPercent,
    windowMinutes: num(w.windowMinutes) ?? 0,
    resetsAt: num(w.resetsAt),
    resets: text(w.resetDescription),
  };
}

export function accountStatusFrom(reply: unknown): AccountStatus {
  const body = record(reply);
  if (body.ok !== true) return NO_ACCOUNT;
  const result = record(body.result);
  const claude = record(result.claude);
  const activeId = text(claude.activeAccountId);

  const accounts: ClaudeAccount[] = [];
  if (Array.isArray(claude.accounts)) {
    for (const raw of claude.accounts) {
      const a = record(raw);
      const id = text(a.id);
      const email = text(a.email);
      if (id === null || email === null) continue;
      accounts.push({
        id,
        email,
        organization: text(a.organizationName),
        kind: 'orca',
        active: id === activeId,
      });
    }
  }
  const systemEmail = text(claude.systemDefaultEmail);
  if (systemEmail !== null) {
    accounts.push({
      id: 'system',
      email: systemEmail,
      organization: null,
      kind: 'system',
      active: activeId === null,
    });
  }

  const limits = record(record(result.rateLimits).claude);
  return {
    reachable: true,
    accounts,
    usage: {
      session: usageWindow(limits.session),
      weekly: usageWindow(limits.weekly),
      updatedAt: num(limits.updatedAt),
      error: text(limits.error),
    },
  };
}

/** Reads it from Orca, at most every `maxAgeMs`; NO_ACCOUNT when Orca does not answer. */
export function orcaAccountReader(
  bin: string = defaultOrcaBin(),
  maxAgeMs = 20_000,
): () => Promise<AccountStatus> {
  let cached: { at: number; value: AccountStatus } | null = null;
  return async () => {
    if (cached !== null && Date.now() - cached.at < maxAgeMs) return cached.value;
    let value: AccountStatus;
    try {
      value = accountStatusFrom(await runOrca(bin, ['account', 'list', '--json']));
    } catch {
      value = NO_ACCOUNT;
    }
    cached = { at: Date.now(), value };
    return value;
  };
}
