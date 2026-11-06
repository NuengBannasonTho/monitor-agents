import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useId } from 'react';
import styles from './page-tabs.module.css';

export interface PageTab<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly icon?: ReactNode;
  /** A number after the label (how many agents). */
  readonly count?: number;
}

interface PageTabsProps<T extends string> {
  readonly tabs: readonly PageTab<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** Accessible name of the tab row. */
  readonly label: string;
}

/**
 * Views of one page (agent filters, settings sections): a row of tabs over a hairline, the
 * picked one underlined; the underline slides between tabs.
 */
export function PageTabs<T extends string>({ tabs, value, onChange, label }: PageTabsProps<T>): React.JSX.Element {
  const underline = useId();
  return (
    <div className={styles.tabs} role="tablist" aria-label={label}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={styles.tab}
            onClick={() => {
              onChange(tab.value);
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && <span className={styles.count}>{tab.count}</span>}
            {active && (
              <motion.span
                layoutId={underline}
                className={styles.underline}
                transition={{ type: 'spring', stiffness: 520, damping: 42 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
