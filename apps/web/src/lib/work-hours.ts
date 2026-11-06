import { isRecord } from '@agent-office/shared';
import { useEffect, useState, useSyncExternalStore } from 'react';

/** Your working day, as "HH:MM" times. Shown beside the office; agents are never paused. */
export interface WorkHours {
  readonly enabled: boolean;
  readonly start: string;
  readonly lunchStart: string;
  readonly lunchEnd: string;
  readonly end: string;
  /** Saturday and Sunday are off. */
  readonly weekendsOff: boolean;
}

export const DEFAULT_WORK_HOURS: WorkHours = {
  enabled: true,
  start: '09:00',
  lunchStart: '12:00',
  lunchEnd: '13:00',
  end: '18:00',
  weekendsOff: true,
};

/**
 * Where the day stands: at work (until lunch or the end of the day), at lunch, or off
 * (until the next working day starts). `until` is when that changes.
 */
export type WorkPeriod =
  | { readonly kind: 'work'; readonly until: Date; readonly next: 'lunch' | 'off' }
  | { readonly kind: 'lunch'; readonly until: Date }
  | { readonly kind: 'off'; readonly until: Date };

/** "09:30" -> 570; null for anything else. */
export function parseTime(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (m?.[1] === undefined || m[2] === undefined) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

function at(day: Date, minutes: number): Date {
  const d = new Date(day);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

function isWorkDay(day: Date, hours: WorkHours): boolean {
  const weekday = day.getDay();
  return !hours.weekendsOff || (weekday !== 0 && weekday !== 6);
}

/** The next time a working day starts, strictly after `now`. */
function nextStart(now: Date, start: number, hours: WorkHours): Date {
  for (let offset = 0; offset <= 7; offset++) {
    const day = new Date(now);
    day.setDate(now.getDate() + offset);
    const begins = at(day, start);
    if (isWorkDay(day, hours) && begins > now) return begins;
  }
  return at(now, start);
}

/** The period `now` falls in, or null when the schedule is off or makes no sense. */
export function periodAt(now: Date, hours: WorkHours): WorkPeriod | null {
  if (!hours.enabled) return null;
  const start = parseTime(hours.start);
  const end = parseTime(hours.end);
  if (start === null || end === null || end <= start) return null;
  const lunchStart = parseTime(hours.lunchStart);
  const lunchEnd = parseTime(hours.lunchEnd);
  // A lunch outside the day (or ending before it starts) is ignored.
  const lunch =
    lunchStart !== null && lunchEnd !== null && start < lunchStart && lunchStart < lunchEnd
      ? { from: lunchStart, to: Math.min(lunchEnd, end) }
      : null;

  const minute = now.getHours() * 60 + now.getMinutes();
  const off = (): WorkPeriod => ({ kind: 'off', until: nextStart(now, start, hours) });
  if (!isWorkDay(now, hours) || minute < start || minute >= end) return off();
  if (lunch !== null && minute >= lunch.from && minute < lunch.to) {
    return { kind: 'lunch', until: at(now, lunch.to) };
  }
  if (lunch !== null && minute < lunch.from) {
    return { kind: 'work', until: at(now, lunch.from), next: 'lunch' };
  }
  return { kind: 'work', until: at(now, end), next: 'off' };
}

/* ------------------------------------------------------------------ */
/* Saved in this browser                                               */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'agent-office:work-hours:v1';
const listeners = new Set<() => void>();

function read(): WorkHours {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_WORK_HOURS;
    const stored: unknown = JSON.parse(raw);
    const value: Readonly<Record<string, unknown>> = isRecord(stored) ? stored : {};
    const time = (v: unknown, fallback: string): string =>
      typeof v === 'string' && parseTime(v) !== null ? v : fallback;
    const flag = (v: unknown, fallback: boolean): boolean =>
      typeof v === 'boolean' ? v : fallback;
    const d = DEFAULT_WORK_HOURS;
    return {
      enabled: flag(value.enabled, d.enabled),
      start: time(value.start, d.start),
      lunchStart: time(value.lunchStart, d.lunchStart),
      lunchEnd: time(value.lunchEnd, d.lunchEnd),
      end: time(value.end, d.end),
      weekendsOff: flag(value.weekendsOff, d.weekendsOff),
    };
  } catch {
    return DEFAULT_WORK_HOURS;
  }
}

let current: WorkHours = typeof window === 'undefined' ? DEFAULT_WORK_HOURS : read();

export function setWorkHours(patch: Partial<WorkHours>): void {
  current = { ...current, ...patch };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage unavailable: the change still applies to this tab.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWorkHours(): WorkHours {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => DEFAULT_WORK_HOURS,
  );
}

/** The current period, re-rendering only when it changes (or the schedule does). */
export function useWorkPeriod(): WorkPeriod | null {
  const hours = useWorkHours();
  const [now, setNow] = useState(() => new Date());
  const period = periodAt(now, hours);
  const until = period?.until.getTime();
  useEffect(() => {
    if (until === undefined) return;
    // A second past the change, so the new period is the one computed.
    const timer = setTimeout(
      () => {
        setNow(new Date());
      },
      Math.max(1_000, until - Date.now() + 1_000),
    );
    return () => {
      clearTimeout(timer);
    };
  }, [until]);
  return period;
}

/** "09:05". */
export function formatHm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "13:00" today, "tomorrow 09:00", or "Mon 09:00". */
export function formatWhen(date: Date, now: Date): string {
  const days = Math.round(
    (new Date(date).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (days <= 0) return formatHm(date);
  if (days === 1) return `tomorrow ${formatHm(date)}`;
  return `${date.toLocaleDateString('en', { weekday: 'short' })} ${formatHm(date)}`;
}
