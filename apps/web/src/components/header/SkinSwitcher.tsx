import type { SkinMode } from '@agent-office/shared';
import { useSkins } from '../../skins/SkinContext';
import { DeskModeIcon, TaskModeIcon } from '../icons';
import type { TabOption } from './Tabs';
import { Tabs } from './Tabs';
import styles from './SkinSwitcher.module.css';

const OPTIONS: readonly TabOption<SkinMode>[] = [
  {
    value: 'by-state',
    label: 'By task',
    hint: 'The costume shows what the agent is doing',
    icon: <TaskModeIcon />,
  },
  {
    value: 'by-agent',
    label: 'By desk',
    hint: 'Each desk keeps its own costume',
    icon: <DeskModeIcon />,
  },
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
      <Tabs
        options={OPTIONS}
        value={skins.mode}
        onChange={skins.setMode}
        label={`Skin: ${skins.pack?.manifest.name ?? ''}`}
      />
    </div>
  );
}
