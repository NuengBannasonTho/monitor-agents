import type { Agent } from '@agent-office/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatSpan } from '../lib/duration';
import { enteredNeedsYou } from '../sound/needsYou';
import { justFinished } from './attention';

const STORAGE_KEY = 'agent-office:alerts:v1';
/** Quick answers you were probably watching anyway are not announced. */
export const ANNOUNCE_TURNS_FROM_MS = 30_000;

export type AlertPermission = NotificationPermission | 'unsupported';

function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeEnabled(value: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Storage unavailable: the toggle still works for this tab.
  }
}

function currentPermission(): AlertPermission {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

/** Only when you are looking elsewhere; the page itself already shows everything. */
function pageInView(): boolean {
  return document.visibilityState === 'visible' && document.hasFocus();
}

/**
 * Desktop notifications (off by default) when an agent starts waiting on you or finishes a
 * longer turn while this tab is in the background. Clicking one brings the tab forward and
 * opens that agent.
 */
export function useDesktopAlerts(
  agents: readonly Agent[],
  onOpen: (id: string) => void,
): {
  readonly enabled: boolean;
  readonly permission: AlertPermission;
  readonly setEnabled: (value: boolean) => void;
} {
  const [permission, setPermission] = useState(currentPermission);
  const [enabled, setEnabledState] = useState(() => readEnabled() && permission === 'granted');
  const waiting = useRef<ReadonlySet<string> | null>(null);
  const finishes = useRef<ReadonlyMap<string, number> | null>(null);
  const openRef = useRef(onOpen);
  useEffect(() => {
    openRef.current = onOpen;
  }, [onOpen]);

  const setEnabled = useCallback((value: boolean) => {
    if (!value) {
      setEnabledState(false);
      writeEnabled(false);
      return;
    }
    if (typeof Notification === 'undefined') return;
    void Notification.requestPermission().then((result) => {
      setPermission(result);
      const on = result === 'granted';
      setEnabledState(on);
      writeEnabled(on);
    });
  }, []);

  useEffect(() => {
    const needs = enteredNeedsYou(waiting.current ?? new Set(), agents);
    const done = justFinished(finishes.current ?? new Map(), agents);
    const first = waiting.current === null;
    waiting.current = needs.current;
    finishes.current = done.current;
    if (first || !enabled || permission !== 'granted' || pageInView()) return;

    const notify = (agent: Agent, title: string, body: string): void => {
      const n = new Notification(title, { body, tag: `agent-office:${agent.id}` });
      n.onclick = () => {
        window.focus();
        openRef.current(agent.id);
        n.close();
      };
    };
    for (const id of needs.entered) {
      const agent = agents.find((a) => a.id === id);
      if (agent !== undefined) {
        notify(agent, `${agent.desk} needs you`, agent.activity[0]?.summary ?? 'Waiting for you');
      }
    }
    for (const agent of done.finished) {
      if ((agent.lastTurnMs ?? 0) < ANNOUNCE_TURNS_FROM_MS) continue;
      notify(agent, `${agent.desk} finished`, `Took ${formatSpan(agent.lastTurnMs ?? 0)}`);
    }
  }, [agents, enabled, permission]);

  return { enabled, permission, setEnabled };
}
