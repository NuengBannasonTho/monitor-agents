import type { ComponentProps } from 'react';
import { cx } from '../../lib/cx';
import styles from './card.module.css';

interface CardProps extends ComponentProps<'section'> {
  /** none: for tables and lists that run edge to edge. */
  readonly padding?: 'none' | 'md' | 'lg';
}

/** A white panel with a hairline border: the one container pages build with. */
export function Card({ padding = 'md', className, ...props }: CardProps) {
  return <section className={cx(styles.card, className)} data-padding={padding} {...props} />;
}
