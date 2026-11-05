import { flushSync } from 'react-dom';
import { useSyncExternalStore } from 'react';

/** Light or dark, or whatever the system uses (the default). */
export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** Read before React starts by the inline script in index.html, to avoid a flash. */
export const THEME_STORAGE_KEY = 'agent-office:theme:v1';

const media =
  typeof window === 'undefined' ? null : window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();

function read(): ThemeChoice {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

let choice: ThemeChoice = typeof window === 'undefined' ? 'system' : read();

/** global.css keys every color off `data-theme` on <html>, falling back to the system. */
function apply(): void {
  if (typeof document === 'undefined') return;
  if (choice === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
}
apply();

function notify(): void {
  for (const listener of listeners) listener();
}
media?.addEventListener('change', notify);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function resolved(): ResolvedTheme {
  if (choice !== 'system') return choice;
  return media?.matches === true ? 'dark' : 'light';
}

function snapshot(): string {
  return `${choice}:${resolved()}`;
}

export function setThemeChoice(next: ThemeChoice): void {
  if (next === choice) return;
  const commit = (): void => {
    choice = next;
    try {
      if (next === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage unavailable: the theme still switches for this tab.
    }
    apply();
    flushSync(notify);
  };
  // Cross-fade the whole page where the browser can, unless motion is reduced.
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce && typeof document.startViewTransition === 'function') {
    document.startViewTransition(commit);
  } else {
    commit();
  }
}

/** The current theme, re-rendering on a switch or when the system theme changes. */
export function useTheme(): {
  readonly choice: ThemeChoice;
  readonly resolved: ResolvedTheme;
  readonly toggle: () => void;
} {
  useSyncExternalStore(subscribe, snapshot, () => 'system:light');
  const current = resolved();
  return {
    choice,
    resolved: current,
    toggle: () => {
      setThemeChoice(current === 'dark' ? 'light' : 'dark');
    },
  };
}
