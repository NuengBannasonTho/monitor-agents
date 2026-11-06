import { RadioGroup } from '@animate-ui/react/primitives/radix-ui/radio-group';
import type { ReactNode } from 'react';
import { CopiedIcon } from '../icons';
import styles from './ChoiceCards.module.css';

export interface Choice<T extends string> {
  readonly value: T;
  readonly label: string;
  /** A quieter line under the label. */
  readonly hint?: string;
  /** Drawn before the text (an emoji, an icon). */
  readonly icon?: ReactNode;
}

interface ChoiceCardsProps<T extends string> {
  readonly options: readonly Choice<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** Accessible name of the group. */
  readonly label: string;
}

/**
 * Pick one of a few options shown as cards in a grid, each with a line about it: a radio
 * group (animate-ui's), the picked card outlined and ticked.
 */
export function ChoiceCards<T extends string>({
  options,
  value,
  onChange,
  label,
}: ChoiceCardsProps<T>) {
  return (
    <RadioGroup.Root
      className={styles.grid}
      value={value}
      aria-label={label}
      onValueChange={(next) => {
        const picked = options.find((o) => o.value === next);
        if (picked !== undefined) onChange(picked.value);
      }}
    >
      {options.map((o) => (
        <RadioGroup.Item key={o.value} value={o.value} className={styles.card}>
          {o.icon !== undefined && (
            <span className={styles.icon} aria-hidden>
              {o.icon}
            </span>
          )}
          <span className={styles.text}>
            <span className={styles.label}>{o.label}</span>
            {o.hint !== undefined && <span className={styles.hint}>{o.hint}</span>}
          </span>
          <span className={styles.tick} aria-hidden>
            <RadioGroup.Indicator>
              <CopiedIcon size={12} />
            </RadioGroup.Indicator>
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
