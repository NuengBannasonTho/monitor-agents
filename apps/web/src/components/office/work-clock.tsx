import type { Zone } from '@agent-office/shared';
import { formatSpanShort } from '../../lib/duration';
import { useNow } from '../../hooks/use-now';
import type { WorkHours, WorkPeriod } from '../../lib/work-hours';
import { formatHm, formatWhen, useWorkHours } from '../../lib/work-hours';
import { LunchIcon, OffHoursIcon, WorkTimeIcon } from '../icons';
import styles from './work-clock.module.css';

interface WorkClockProps {
  readonly zone: Zone;
  readonly period: WorkPeriod;
  /** Agents at work right now: during lunch or off hours they are working through it. */
  readonly working: number;
}

const ICON = { work: WorkTimeIcon, lunch: LunchIcon, off: OffHoursIcon } as const;

/** What the day is doing, as each panel tells it. */
function describe(zone: Zone, period: WorkPeriod, now: Date, working: number): string {
  const when = formatWhen(period.until, now);
  const left = formatSpanShort(period.until.getTime() - now.getTime());
  const still = working > 0 ? ` · ${String(working)} working` : '';
  if (zone === 'table') {
    if (period.kind === 'work') {
      return period.next === 'lunch' ? `Work · lunch at ${when}` : `Work · until ${when}`;
    }
    return period.kind === 'lunch'
      ? `Lunch break · back at ${when}${still}`
      : `Off hours · back ${when}${still}`;
  }
  if (period.kind === 'work') {
    return period.next === 'lunch' ? `Lunch at ${when}` : `Day ends ${when}`;
  }
  return period.kind === 'lunch' ? `Lunch until ${when} · ${left} left` : `Resting until ${when}`;
}

function scheduleHint(hours: WorkHours): string {
  return `Work ${hours.start}–${hours.end}, lunch ${hours.lunchStart}–${hours.lunchEnd}${
    hours.weekendsOff ? ', weekends off' : ''
  }. Agents are never paused; change the hours in Settings.`;
}

/**
 * The clock in a panel's title bar: the time, and whether it is work, lunch or off hours,
 * with when that ends. Agent Work counts anyone working through lunch or after hours.
 */
export function WorkClock({ zone, period, working }: WorkClockProps): React.JSX.Element {
  const hours = useWorkHours();
  const now = new Date(useNow(15_000));
  const Icon = ICON[period.kind];
  const text = describe(zone, period, now, working);
  return (
    <span
      className={styles.clock}
      data-period={period.kind}
      data-overtime={zone === 'table' && period.kind !== 'work' && working > 0 ? 'true' : undefined}
      title={`${text}. ${scheduleHint(hours)}`}
    >
      <Icon size={14} className={styles.icon} />
      <time className={styles.time} dateTime={now.toISOString()}>
        {formatHm(now)}
      </time>
      <span className={styles.text}>{text}</span>
    </span>
  );
}
