import { Tooltip } from '@animate-ui/react/primitives/radix-ui/tooltip';
import type { ReactNode } from 'react';
import styles from './hint.module.css';

interface HintProps {
  /** What shows on hover or keyboard focus. */
  readonly content: ReactNode;
  readonly side?: 'top' | 'right' | 'bottom' | 'left';
  /** One element that can take focus. */
  readonly children: React.JSX.Element;
}

/** A small dark label over something, on hover or focus: the app's one tooltip. */
export function Hint({ content, side = 'top', children }: HintProps): React.JSX.Element {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className={styles.hint} side={side} sideOffset={8}>
          {content}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
