import { UsageReportSchema } from '@agent-office/shared';
import type { UsageRange } from '@agent-office/shared';
import type { UsageState } from './usage.models';

/** One read of the usage report for a range. */
export async function fetchUsage(range: UsageRange): Promise<UsageState> {
  try {
    const response = await fetch(`/api/usage?range=${range}`);
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error =
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof body.error === 'string'
          ? body.error
          : 'The server did not answer.';
      return { status: 'error', error };
    }
    const parsed = UsageReportSchema.safeParse(body);
    return parsed.success
      ? { status: 'ready', report: parsed.data }
      : {
          status: 'error',
          error: 'The server sent a report this page cannot read.',
        };
  } catch {
    return {
      status: 'error',
      error: 'The server is not reachable (is pnpm start running?).',
    };
  }
}
