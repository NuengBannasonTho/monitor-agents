import { UsageReportSchema } from '@agent-office/shared';
import type { UsageRange, UsageReport } from '@agent-office/shared';
import { useCallback, useEffect, useState } from 'react';

/** Transcripts grow while agents work; a fresh read costs the server only what was added. */
const REFRESH_MS = 30_000;

export type UsageState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly report: UsageReport }
  | { readonly status: 'error'; readonly error: string };

async function fetchUsage(range: UsageRange): Promise<UsageState> {
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

/**
 * The usage report for a range, kept fresh while the page is open; switching range keeps
 * the last report on screen until the new one arrives. Null `range` fetches nothing.
 */
export function useUsage(range: UsageRange | null): {
  state: UsageState;
  reload: () => void;
} {
  const [state, setState] = useState<UsageState>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (range === null) return;
    let live = true;
    const load = () => {
      void fetchUsage(range).then((next) => {
        // A failed refresh keeps the report already shown.
        if (live)
          setState((current) =>
            next.status === 'error' && current.status === 'ready' ? current : next,
          );
      });
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    window.addEventListener('focus', load);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', load);
    };
  }, [range, tick]);

  return { state, reload };
}
