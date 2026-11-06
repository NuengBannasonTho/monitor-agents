import type { UsageRange } from '@agent-office/shared';
import { useCallback, useEffect, useState } from 'react';
import type { UsageState } from './usage.models';
import { fetchUsage } from './usage.services';

/** Transcripts grow while agents work; a fresh read costs the server only what was added. */
const REFRESH_MS = 30_000;

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
