import type { CSSProperties, ReactNode } from 'react';
import styles from './Meter.module.css';

interface MeterProps {
  readonly label: ReactNode;
  /** 0–100. */
  readonly percent: number;
  /** A quieter line under the bar ("Resets 2:20 PM"). */
  readonly detail?: ReactNode;
}

/** How much of something is used: a label and percent over a bar that warms as it fills. */
export function Meter({ label, percent, detail }: MeterProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const tone = clamped >= 85 ? 'high' : clamped >= 60 ? 'mid' : 'low';
  return (
    <div className={styles.meter} data-tone={tone}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        <span className={styles.percent}>{Math.round(clamped)}%</span>
      </div>
      <div
        className={styles.track}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
      >
        <span
          className={styles.fill}
          style={{ '--value': `${String(clamped)}%` } as CSSProperties}
        />
      </div>
      {detail !== undefined && <span className={styles.detail}>{detail}</span>}
    </div>
  );
}
