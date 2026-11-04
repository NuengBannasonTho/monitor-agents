import { Switch } from '@animate-ui/react/primitives/radix-ui/switch';
import styles from './SoundToggle.module.css';

interface SoundToggleProps {
  readonly enabled: boolean;
  readonly onChange: (enabled: boolean) => void;
}

export function SoundToggle({ enabled, onChange }: SoundToggleProps) {
  return (
    <label
      className={styles.wrap}
      htmlFor="needs-you-sound"
      title="Play a chime when an agent needs you"
    >
      <span className={styles.label}>Sound</span>
      <Switch.Root
        id="needs-you-sound"
        className={styles.root}
        checked={enabled}
        onCheckedChange={onChange}
      >
        <Switch.Thumb className={styles.thumb} />
      </Switch.Root>
    </label>
  );
}
