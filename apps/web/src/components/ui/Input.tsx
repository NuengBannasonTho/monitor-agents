import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Input.module.css';

interface InputProps extends ComponentProps<'input'> {
  /** Drawn inside, before the text (a search glass). */
  readonly icon?: ReactNode;
  readonly invalid?: boolean;
  /** Round ends, for a search box on the page. */
  readonly pill?: boolean;
}

/** The app's one text field (search, names, times). */
export function Input({ icon, invalid = false, pill = false, className, ...props }: InputProps) {
  return (
    <span
      className={cx(styles.frame, className)}
      data-invalid={invalid || undefined}
      data-pill={pill || undefined}
      data-disabled={props.disabled === true || undefined}
    >
      {icon !== undefined && <span className={styles.icon}>{icon}</span>}
      <input className={styles.input} aria-invalid={invalid || undefined} {...props} />
    </span>
  );
}
