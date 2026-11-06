import type { ReactNode } from 'react';
import styles from './field.module.css';

interface FieldProps {
  /** The control's id, so clicking the label focuses it. */
  readonly id?: string;
  readonly label: ReactNode;
  /** Help under the control; an error replaces it. */
  readonly hint?: ReactNode;
  readonly error?: string | undefined;
  readonly children: ReactNode;
}

/** A label, the control, then a hint or what is wrong with it. */
export function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div className={styles.field} data-invalid={error !== undefined || undefined}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children}
      {error !== undefined ? (
        <span className={styles.error}>{error}</span>
      ) : hint !== undefined ? (
        <span className={styles.hint}>{hint}</span>
      ) : null}
    </div>
  );
}
