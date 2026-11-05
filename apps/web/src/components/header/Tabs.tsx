import { ToggleGroup } from '@animate-ui/react/primitives/radix-ui/toggle-group';
import type { ReactNode } from 'react';
import { useTheme } from '../../lib/theme';
import styles from './Tabs.module.css';

export interface TabOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly icon?: ReactNode;
  /** Shown on hover; defaults to the label. */
  readonly hint?: string;
}

interface TabsProps<T extends string> {
  readonly options: readonly TabOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** Accessible name of the group, e.g. "Theme". */
  readonly label: string;
}

/**
 * The app's one segmented control (costume mode, theme): an icon and a label per tab, and a
 * highlight that slides to the picked one.
 */
export function Tabs<T extends string>({ options, value, onChange, label }: TabsProps<T>) {
  const theme = useTheme().resolved;
  return (
    <ToggleGroup.Root
      // The sliding highlight copies the picked tab's colors once; re-read them per theme.
      key={theme}
      type="single"
      className={styles.group}
      value={value}
      onValueChange={(next) => {
        // Radix sends "" when the active tab is clicked again: keep the current value.
        const picked = options.find((o) => o.value === next);
        if (picked !== undefined) onChange(picked.value);
      }}
      aria-label={label}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className={styles.item}
          title={o.hint ?? o.label}
        >
          {o.icon}
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
