import { AccountStatusSchema, NO_ACCOUNT } from '@agent-office/shared';
import type { AccountStatus } from '@agent-office/shared';

/** The Claude account and its usage, as Orca reports it; nothing known when it does not answer. */
export async function fetchAccount(): Promise<AccountStatus> {
  try {
    const response = await fetch('/api/account');
    if (!response.ok) return NO_ACCOUNT;
    const parsed = AccountStatusSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : NO_ACCOUNT;
  } catch {
    return NO_ACCOUNT;
  }
}
