import { Switch } from '@animate-ui/react/primitives/radix-ui/switch';
import type { ReactNode } from 'react';
import styles from './HeaderSwitch.module.css';

interface HeaderSwitchProps {
  readonly id: string;
  readonly label: string;
  /** Shown before the label. */
  readonly icon?: ReactNode;
  /** What the switch does, shown on hover. */
  readonly hint: string;
  readonly enabled: boolean;
  readonly disabled?: boolean;
  readonly onChange: (enabled: boolean) => void;
}

/** A labelled pixel switch for the header (Sound, Alerts). */
export function HeaderSwitch({
  id,
  label,
  icon,
  hint,
  enabled,
  disabled,
  onChange,
}: HeaderSwitchProps) {
  return (
    <label className={styles.wrap} htmlFor={id} title={hint} data-disabled={disabled}>
      <span className={styles.label}>
        {icon}
        {label}
      </span>
      <Switch.Root
        id={id}
        className={styles.root}
        checked={enabled}
        disabled={disabled}
        onCheckedChange={onChange}
      >
        <Switch.Thumb className={styles.thumb} />
      </Switch.Root>
    </label>
  );
}
