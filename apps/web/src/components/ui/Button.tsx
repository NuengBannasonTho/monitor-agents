import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost' | 'link';

interface ButtonProps extends ComponentProps<'button'> {
  /** primary: the one main action; secondary: a quieter one; link: text that acts. */
  readonly variant?: ButtonVariant;
  readonly size?: 'md' | 'sm' | 'lg';
  /** Drawn before the label. */
  readonly icon?: ReactNode;
  /** A round button with just the icon; give it an aria-label. */
  readonly iconOnly?: boolean;
}

/**
 * The button look for something that is not a <button>: a link, or animate-ui's CopyButton.
 * Spread it on the element; `className` adds your own class.
 */
export function buttonLook(
  variant: ButtonVariant = 'secondary',
  size: 'md' | 'sm' | 'lg' = 'md',
  className?: string,
): { className: string; 'data-variant': ButtonVariant; 'data-size': string } {
  return { className: cx(styles.button, className), 'data-variant': variant, 'data-size': size };
}

/** The app's one button: a pill in a few variants, pressing in slightly on click. */
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconOnly = false,
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.button, className)}
      data-variant={variant}
      data-size={size}
      data-icon-only={iconOnly || undefined}
      {...props}
    >
      {icon}
      {!iconOnly && children}
    </button>
  );
}
