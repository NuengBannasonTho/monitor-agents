import type { ComponentProps } from 'react';
import { cx } from '../../lib/cx';
import styles from './textarea.module.css';

interface TextareaProps extends ComponentProps<'textarea'> {
  readonly invalid?: boolean;
  /** Monospace, for prompts and code. */
  readonly mono?: boolean;
}

/** The app's one multi-line field. */
export function Textarea({ invalid = false, mono = false, className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cx(styles.textarea, className)}
      data-mono={mono || undefined}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}
