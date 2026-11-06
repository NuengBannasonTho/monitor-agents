import { RadioGroup } from '@animate-ui/react/primitives/radix-ui/radio-group';
import { CUSTOM_AGENT_COLORS } from '@agent-office/shared';
import type { CustomAgentColor } from '@agent-office/shared';
import { COLOR_HEX } from '../customAgents/colors';
import styles from './ColorSwatches.module.css';

interface ColorSwatchesProps {
  readonly value: CustomAgentColor;
  readonly onChange: (color: CustomAgentColor) => void;
  readonly id?: string;
  readonly label: string;
}

/** A row of round color swatches (the app's subagent colors), one picked. */
export function ColorSwatches({ value, onChange, id, label }: ColorSwatchesProps) {
  return (
    <RadioGroup.Root
      id={id}
      className={styles.swatches}
      value={value}
      orientation="horizontal"
      aria-label={label}
      onValueChange={(next) => {
        const picked = CUSTOM_AGENT_COLORS.find((c) => c === next);
        if (picked !== undefined) onChange(picked);
      }}
    >
      {CUSTOM_AGENT_COLORS.map((c) => (
        <RadioGroup.Item
          key={c}
          value={c}
          className={styles.swatch}
          style={{ background: COLOR_HEX[c] }}
          title={c}
          aria-label={c}
        />
      ))}
    </RadioGroup.Root>
  );
}
