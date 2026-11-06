import type { CSSProperties, ReactNode } from 'react';
import styles from './share-bar.module.css';

interface ShareBarProps {
  /** The number beside the bar ("12", "$4.20"). */
  readonly label: ReactNode;
  readonly value: number;
  /** The largest value in the column: its bar is full. */
  readonly max: number;
  /** A quieter note after the label ("37%"). */
  readonly note?: ReactNode;
}

/**
 * How one row compares with the rest of its column: its number, then a thin bar as long as
 * its share of the largest. For "which is used most", not for "how full".
 */
export function ShareBar({ label, value, max, note }: ShareBarProps): React.JSX.Element {
  const width = max <= 0 || value <= 0 ? 0 : Math.max(2, (Math.min(value, max) / max) * 100);
  return (
    <span className={styles.share}>
      <span className={styles.label}>
        {label}
        {note !== undefined && <span className={styles.note}>{note}</span>}
      </span>
      <span className={styles.track} aria-hidden>
        <span className={styles.fill} style={{ '--value': `${String(width)}%` } as CSSProperties} />
      </span>
    </span>
  );
}
