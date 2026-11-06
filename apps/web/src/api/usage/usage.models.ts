import type { UsageReport } from '@agent-office/shared';

/** The Usage page's report: loading, ready, or why it is not there. */
export type UsageState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly report: UsageReport }
  | { readonly status: 'error'; readonly error: string };
