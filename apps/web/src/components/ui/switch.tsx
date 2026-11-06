import { Switch as SwitchPrimitive } from '@animate-ui/react/primitives/radix-ui/switch';
import styles from './switch.module.css';

interface SwitchProps {
  /** Lets a `<label htmlFor>` name the switch. */
  readonly id: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onChange: (checked: boolean) => void;
}

/** An on/off switch with a springy thumb. */
export function Switch({ id, checked, disabled, onChange }: SwitchProps): React.JSX.Element {
  return (
    <SwitchPrimitive.Root
      id={id}
      className={styles.root}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
    >
      <SwitchPrimitive.Thumb className={styles.thumb} />
    </SwitchPrimitive.Root>
  );
}
