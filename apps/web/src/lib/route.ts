import { useMemo, useSyncExternalStore } from 'react';

/**
 * Which page is showing, kept in the query string so a reload stays put and the browser's
 * Back button walks back through pages: /?page=agents, /?page=settings&section=desktop.
 * No page is the office. The query string, not a path: the server only serves index.html at /.
 */
export type Page = 'new-task' | 'office' | 'agents' | 'usage' | 'custom-agents' | 'settings';

export interface Route {
  readonly page: Page;
  /** The settings section, the Agents page's filter or the Usage page's tab; null elsewhere. */
  readonly section: string | null;
}

const PAGES: readonly Page[] = [
  'new-task',
  'office',
  'agents',
  'usage',
  'custom-agents',
  'settings',
];
/** pushState fires no event of its own; this one tells the hook to read the URL again. */
const CHANGE_EVENT = 'agent-office:route';

function subscribe(listener: () => void): () => void {
  window.addEventListener('popstate', listener);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener('popstate', listener);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}

const search = (): string => window.location.search;

export function parseRoute(query: string): Route {
  const params = new URLSearchParams(query);
  const page = params.get('page');
  // ?settings=<section>, from before settings had a page= of its own.
  const oldSettings = params.get('settings');
  if (page === null && oldSettings !== null) return { page: 'settings', section: oldSettings };
  const known = PAGES.find((p) => p === page) ?? 'office';
  const hasSection = known === 'settings' || known === 'agents' || known === 'usage';
  return { page: known, section: hasSection ? params.get('section') : null };
}

export function useRoute(): Route {
  const query = useSyncExternalStore(subscribe, search);
  return useMemo(() => parseRoute(query), [query]);
}

/**
 * Shows a page (a new history entry), or another settings section (replacing the entry, so
 * Back leaves settings instead of stepping through its sections).
 */
export function navigate(page: Page, section: string | null = null): void {
  const current = parseRoute(window.location.search);
  if (current.page === page && current.section === section) return;
  const url = new URL(window.location.href);
  url.searchParams.delete('settings');
  if (page === 'office') url.searchParams.delete('page');
  else url.searchParams.set('page', page);
  if (section === null) url.searchParams.delete('section');
  else url.searchParams.set('section', section);
  if (current.page === page) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
