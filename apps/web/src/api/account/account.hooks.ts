import type { AccountStatus } from '@agent-office/shared';
import { useEffect, useState } from 'react';
import { fetchAccount } from './account.services';

/** Usage moves slowly; Orca refreshes it every few minutes. */
const REFRESH_MS = 60_000;

/** The Claude account and its usage, kept fresh while the page is open; null until known. */
export function useAccount(enabled: boolean): AccountStatus | null {
  const [status, setStatus] = useState<AccountStatus | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const load = () => {
      void fetchAccount().then((next) => {
        if (live) setStatus(next);
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
  }, [enabled]);
  return status;
}
