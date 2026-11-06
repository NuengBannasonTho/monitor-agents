import type { CSSProperties, ReactNode } from 'react';
import styles from './stat-card.module.css';

const SEGMENTS = 16;

interface StatCardProps {
  readonly value: number;
  /** The value as it should read ("$12.30", "4.2M"); the plain number otherwise. */
  readonly display?: string;
  readonly label: string;
  /** A quieter line under the value ("$4.10 by subagents"). */
  readonly detail?: ReactNode;
  readonly icon?: ReactNode;
  /** With a total, a bar of segments shows the share; its color is `color`. */
  readonly total?: number;
  readonly color?: string;
}

/** One number at a glance: large, its label, and how much of the whole it is. */
export function StatCard({ value, display, label, detail, icon, total, color }: StatCardProps): React.JSX.Element {
  const filled =
    total === undefined || total === 0
      ? 0
      : Math.round((Math.min(value, total) / total) * SEGMENTS);
  return (
    <div
      className={styles.card}
      style={color === undefined ? undefined : ({ '--tone': color } as CSSProperties)}
    >
      <span className={styles.value}>{display ?? value}</span>
      {detail !== undefined && <span className={styles.detail}>{detail}</span>}
      <span className={styles.foot}>
        <span className={styles.label}>
          {icon}
          {label}
        </span>
        {total !== undefined && (
          <span className={styles.bar} aria-hidden>
            {Array.from({ length: SEGMENTS }, (_, i) => (
              <span key={i} className={styles.segment} data-on={i < filled || undefined} />
            ))}
          </span>
        )}
      </span>
    </div>
  );
}
