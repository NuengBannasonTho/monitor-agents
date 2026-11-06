import { describe, expect, it } from 'vitest';
import type { WorkHours } from './work-hours';
import { DEFAULT_WORK_HOURS, formatWhen, parseTime, periodAt } from './work-hours';

/** Wednesday 5 Nov 2025, local time. */
const wed = (h: number, m = 0): Date => new Date(2025, 10, 5, h, m);
const hm = (d: Date | undefined): string =>
  d === undefined ? '' : `${String(d.getDate())} ${String(d.getHours())}:${String(d.getMinutes())}`;

describe('periodAt', () => {
  const hours = DEFAULT_WORK_HOURS;

  it('is work until lunch, lunch until it ends, then work until the end of the day', () => {
    expect(periodAt(wed(10), hours)).toMatchObject({ kind: 'work', next: 'lunch' });
    expect(hm(periodAt(wed(10), hours)?.until)).toBe('5 12:0');
    expect(periodAt(wed(12, 15), hours)?.kind).toBe('lunch');
    expect(hm(periodAt(wed(12, 15), hours)?.until)).toBe('5 13:0');
    expect(periodAt(wed(13), hours)).toMatchObject({ kind: 'work', next: 'off' });
    expect(hm(periodAt(wed(13), hours)?.until)).toBe('5 18:0');
  });

  it('is off before the day starts and after it ends, until the next start', () => {
    expect(hm(periodAt(wed(7), hours)?.until)).toBe('5 9:0');
    expect(periodAt(wed(18), hours)?.kind).toBe('off');
    expect(hm(periodAt(wed(18), hours)?.until)).toBe('6 9:0');
  });

  it('skips the weekend when weekends are off', () => {
    const friday = new Date(2025, 10, 7, 19);
    expect(hm(periodAt(friday, hours)?.until)).toBe('10 9:0');
    const saturday = new Date(2025, 10, 8, 11);
    expect(periodAt(saturday, hours)?.kind).toBe('off');
    expect(periodAt(saturday, { ...hours, weekendsOff: false })?.kind).toBe('work');
  });

  it('ignores a lunch outside the day, and the whole schedule when it ends before it starts', () => {
    const noLunch: WorkHours = { ...hours, lunchStart: '13:00', lunchEnd: '12:00' };
    expect(periodAt(wed(12, 30), noLunch)).toMatchObject({ kind: 'work', next: 'off' });
    expect(periodAt(wed(10), { ...hours, end: '08:00' })).toBeNull();
    expect(periodAt(wed(10), { ...hours, enabled: false })).toBeNull();
  });
});

describe('time helpers', () => {
  it('parses HH:MM', () => {
    expect(parseTime('09:30')).toBe(570);
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('nope')).toBeNull();
  });

  it('says when, relative to today', () => {
    expect(formatWhen(wed(13), wed(12))).toBe('13:00');
    expect(formatWhen(new Date(2025, 10, 6, 9), wed(19))).toBe('tomorrow 09:00');
    expect(formatWhen(new Date(2025, 10, 10, 9), new Date(2025, 10, 7, 19))).toBe('Mon 09:00');
  });
});
