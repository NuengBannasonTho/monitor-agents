import { SkinModeSchema } from '@agent-office/shared';
import type { SkinMode } from '@agent-office/shared';
import { ToggleGroup } from '@animate-ui/react/primitives/radix-ui/toggle-group';
import { useSkins } from '../../skins/SkinContext';
import styles from './SkinSwitcher.module.css';

const OPTIONS: readonly { value: SkinMode; label: string; hint: string }[] = [
  { value: 'pixel', label: 'Pixel', hint: 'Built-in pixel workers' },
  { value: 'by-state', label: 'By task', hint: 'The costume shows what the agent is doing' },
  { value: 'by-agent', label: 'By desk', hint: 'Each desk keeps its own costume' },
];

/** Shown only when the server has at least one skin pack installed. */
export function SkinSwitcher() {
  const skins = useSkins();
  if (skins.packs.length === 0) return null;

  return (
    <div className={styles.wrap}>
      {skins.packs.length > 1 && (
        <select
          id="skin-pack"
          className={styles.select}
          value={skins.pack?.id ?? ''}
          onChange={(e) => {
            skins.setPack(e.target.value);
          }}
          aria-label="Skin pack"
        >
          {skins.packs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.manifest.name}
            </option>
          ))}
        </select>
      )}
      <ToggleGroup.Root
        type="single"
        className={styles.group}
        value={skins.mode}
        onValueChange={(value) => {
          // Radix sends "" when the active item is clicked again; keep the current mode.
          const parsed = SkinModeSchema.safeParse(value);
          if (parsed.success) skins.setMode(parsed.data);
        }}
        aria-label={`Skin: ${skins.pack?.manifest.name ?? ''}`}
      >
        {OPTIONS.map((o) => (
          <ToggleGroup.Item key={o.value} value={o.value} className={styles.item} title={o.hint}>
            {o.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  );
}
