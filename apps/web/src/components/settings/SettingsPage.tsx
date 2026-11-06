import type { Agent, DesktopStatus, SkinMode } from '@agent-office/shared';
import type { ReactNode } from 'react';
import type { IconProps } from 'reicon-react/createIcon';
import { navigate } from '../../lib/route';
import type { ResolvedTheme } from '../../lib/theme';
import { setThemeChoice, useTheme } from '../../lib/theme';
import { setAgentHidden, setDesktopWalkers } from '../../live/desktop';
import { KIND_META } from '../office/kind';
import { STATE_COLOR_VAR, STATE_LABEL } from '../office/stateMeta';
import type { AlertPermission } from '../../live/useDesktopAlerts';
import type { WorkHours } from '../../lib/workHours';
import { parseTime, setWorkHours, useWorkHours } from '../../lib/workHours';
import { useSkins } from '../../skins/SkinContext';
import {
  AlertsIcon,
  AppearanceIcon,
  CostumeIcon,
  DarkModeIcon,
  DeskModeIcon,
  DesktopWalkersIcon,
  LightModeIcon,
  STATE_ICON,
  ShowIcon,
  LunchIcon,
  OffHoursIcon,
  SoundIcon,
  TaskModeIcon,
  WorkTimeIcon,
} from '../icons';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Card } from '../ui/Card';
import { Page } from '../ui/Page';
import { PageTabs } from '../ui/PageTabs';
import { Switch } from '../ui/Switch';
import type { TabOption } from '../ui/Tabs';
import { Tabs } from '../ui/Tabs';
import styles from './SettingsPage.module.css';

export interface SettingsProps {
  readonly sound: {
    readonly enabled: boolean;
    readonly setEnabled: (value: boolean) => void;
  };
  readonly alerts: {
    readonly enabled: boolean;
    readonly permission: AlertPermission;
    readonly setEnabled: (value: boolean) => void;
  };
  /** The desktop app's setting and whether it runs; null in the preview or with an old server. */
  readonly desktop: DesktopStatus | null;
  /** Every agent right now, to pick which ones walk on the desktop. */
  readonly agents: readonly Agent[];
}

interface SettingsPageProps extends SettingsProps {
  /** The section named in the URL; none or an unknown one shows the first. */
  readonly section: string | null;
}

type SectionId = 'notifications' | 'appearance' | 'desktop' | 'work-hours' | 'costumes';

interface SectionMeta {
  readonly id: SectionId;
  readonly title: string;
  readonly hint: string;
  readonly Icon: (props: IconProps) => React.JSX.Element;
}

const NOTIFICATIONS: SectionMeta = {
  id: 'notifications',
  title: 'Notifications',
  hint: 'How you hear that an agent needs you',
  Icon: AlertsIcon,
};

const SECTIONS: readonly SectionMeta[] = [
  NOTIFICATIONS,
  {
    id: 'appearance',
    title: 'Appearance',
    hint: 'How the page and both scenes look',
    Icon: AppearanceIcon,
  },
  {
    id: 'desktop',
    title: 'Desktop',
    hint: 'Bananas walking along the bottom of your screen, so this page can stay closed',
    Icon: DesktopWalkersIcon,
  },
  {
    id: 'work-hours',
    title: 'Work hours',
    hint: 'Your working day, as a clock on each panel. Agents are never paused by it.',
    Icon: WorkTimeIcon,
  },
  {
    id: 'costumes',
    title: 'Costumes',
    hint: 'What your agents wear',
    Icon: CostumeIcon,
  },
];

const THEMES: readonly TabOption<ResolvedTheme>[] = [
  {
    value: 'light',
    label: 'Light',
    hint: 'Daytime scenes',
    icon: <LightModeIcon />,
  },
  {
    value: 'dark',
    label: 'Dark',
    hint: 'Night scenes',
    icon: <DarkModeIcon />,
  },
];

const SKIN_MODES: readonly TabOption<SkinMode>[] = [
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

const ALERTS_HINT: Readonly<Record<AlertPermission, string>> = {
  default: 'Notify you when an agent needs you or finishes while this tab is in the background',
  granted: 'Notify you when an agent needs you or finishes while this tab is in the background',
  denied: 'Blocked for this page. Allow notifications in your browser’s site settings.',
  unsupported: 'This browser cannot show desktop notifications',
};

/**
 * Every preference on a page of its own (/?page=settings&section=…): the sections on the
 * left, the chosen one on the right. Changes apply right away.
 */
export function SettingsPage({ section, ...props }: SettingsPageProps) {
  const skins = useSkins();
  // Costumes only once the server has a skin pack installed.
  const sections = SECTIONS.filter((s) => s.id !== 'costumes' || skins.packs.length > 0);
  const current = sections.find((s) => s.id === section) ?? NOTIFICATIONS;

  return (
    <Page trail={['Settings', current.title]} title="Settings" subtitle="Changes apply right away.">
      <PageTabs
        tabs={sections.map(({ id, title, Icon }) => ({
          value: id,
          label: title,
          icon: <Icon size={16} />,
        }))}
        value={current.id}
        onChange={(id) => {
          navigate('settings', id);
        }}
        label="Settings sections"
      />
      <Card key={current.id} className={styles.content} aria-labelledby="settings-title">
        <header className={styles.contentHeader}>
          <h2 id="settings-title" className={styles.contentTitle}>
            {current.title}
          </h2>
          <p className={styles.contentHint}>{current.hint}</p>
        </header>
        <div className={styles.list}>
          <SectionRows id={current.id} {...props} />
        </div>
      </Card>
    </Page>
  );
}

function SectionRows({ id, sound, alerts, desktop, agents }: SettingsProps & { id: SectionId }) {
  switch (id) {
    case 'notifications':
      return (
        <>
          <SwitchRow
            id="setting-sound"
            icon={<SoundIcon size={20} />}
            title="Sound"
            hint="Play a chime when an agent needs you"
            checked={sound.enabled}
            onChange={sound.setEnabled}
          />
          {alerts.permission !== 'unsupported' && (
            <SwitchRow
              id="setting-alerts"
              icon={<AlertsIcon size={20} />}
              title="Desktop alerts"
              hint={ALERTS_HINT[alerts.permission]}
              checked={alerts.enabled}
              disabled={alerts.permission === 'denied'}
              onChange={alerts.setEnabled}
            />
          )}
        </>
      );
    case 'appearance':
      return <ThemeRow />;
    case 'desktop':
      return <DesktopRows desktop={desktop} agents={agents} />;
    case 'work-hours':
      return <WorkHoursRows />;
    case 'costumes':
      return <CostumeRows />;
  }
}

interface RowTextProps {
  readonly icon: ReactNode;
  readonly title: string;
  readonly hint: string;
}

function RowText({ icon, title, hint }: RowTextProps) {
  return (
    <>
      <span className={styles.rowIcon}>{icon}</span>
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        <span className={styles.rowHint}>{hint}</span>
      </span>
    </>
  );
}

interface SwitchRowProps extends RowTextProps {
  readonly id: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onChange: (checked: boolean) => void;
}

/** The whole row is the switch's label, so a click anywhere on it flips the switch. */
function SwitchRow({ id, checked, disabled, onChange, ...text }: SwitchRowProps) {
  return (
    <label className={styles.row} htmlFor={id} data-disabled={disabled}>
      <RowText {...text} />
      <Switch id={id} checked={checked} disabled={disabled} onChange={onChange} />
    </label>
  );
}

/** A row with its choices on a line of their own, under the text. */
function ChoiceRow({ children, ...text }: RowTextProps & { children: ReactNode }) {
  return (
    <div className={styles.row} data-stacked>
      <RowText {...text} />
      <div className={styles.choices}>{children}</div>
    </div>
  );
}

/** What the desktop app is doing, in a few words. */
function desktopHint(desktop: DesktopStatus | null): string {
  if (desktop === null) return 'Restart the server (pnpm start) to control it from here';
  if (!desktop.connected) {
    return desktop.walkers
      ? 'They walk out once the desktop app runs: pnpm desktop'
      : 'Off. The desktop app is not running either (pnpm desktop)';
  }
  return desktop.walkers ? 'Walking along the bottom of your screen now' : 'Hidden, out of the way';
}

/**
 * The bananas walking on your desktop (apps/desktop): all on or off, and which agents walk.
 * Right-clicking a banana on the desktop hides it too; it comes back from here.
 */
function DesktopRows({
  desktop,
  agents,
}: {
  desktop: DesktopStatus | null;
  agents: readonly Agent[];
}) {
  const hidden = new Set(desktop?.hidden ?? []);
  const hiddenNow = agents.filter((a) => hidden.has(a.id)).length;
  return (
    <>
      <SwitchRow
        id="setting-desktop-walkers"
        icon={<DesktopWalkersIcon size={20} />}
        title="Bananas on the desktop"
        hint={desktopHint(desktop)}
        checked={desktop?.walkers ?? false}
        disabled={desktop === null}
        onChange={(walkers) => {
          void setDesktopWalkers(walkers);
        }}
      />
      {desktop !== null && (
        <div className={styles.row} data-stacked>
          <RowText
            icon={<ShowIcon size={20} />}
            title="Who walks"
            hint={
              agents.length === 0
                ? 'No agents right now'
                : hiddenNow === 0
                  ? 'Everyone. Turn one off, or right-click its banana → Hide this banana'
                  : `${String(agents.length - hiddenNow)} of ${String(agents.length)} walk; ${String(hiddenNow)} hidden`
            }
          />
          {agents.length > 0 && (
            <ul className={styles.walkerList} data-off={desktop.walkers ? undefined : 'true'}>
              {agents.map((agent) => {
                const StateIcon = STATE_ICON[agent.state];
                const id = `setting-walker-${agent.id}`;
                const shown = !hidden.has(agent.id);
                return (
                  <li key={agent.id}>
                    <label className={styles.walkerItem} htmlFor={id}>
                      <StateIcon size={16} style={{ color: STATE_COLOR_VAR[agent.state] }} />
                      <span className={styles.walkerText}>
                        <span className={styles.walkerName}>{agent.desk}</span>
                        <span className={styles.walkerState}>
                          {KIND_META[agent.kind].label} · {STATE_LABEL[agent.state]}
                        </span>
                      </span>
                      <Switch
                        id={id}
                        checked={shown}
                        onChange={(show) => {
                          void setAgentHidden(agent.id, !show);
                        }}
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

/** Your working day, shown as a clock on each panel. Agents are never paused by it. */
function WorkHoursRows() {
  const hours = useWorkHours();
  return (
    <>
      <SwitchRow
        id="setting-work-hours"
        icon={<WorkTimeIcon size={20} />}
        title="Show work hours"
        hint="A clock on each panel: work, lunch break or off hours, and when that ends"
        checked={hours.enabled}
        onChange={(enabled) => {
          setWorkHours({ enabled });
        }}
      />
      {hours.enabled && (
        <>
          <ChoiceRow icon={<WorkTimeIcon size={20} />} title="Working day" hint="From and to">
            <TimeRange hours={hours} from="start" to="end" label="Working day" />
          </ChoiceRow>
          <ChoiceRow
            icon={<LunchIcon size={20} />}
            title="Lunch break"
            hint="Base Camp shows when it ends"
          >
            <TimeRange hours={hours} from="lunchStart" to="lunchEnd" label="Lunch break" />
          </ChoiceRow>
          <SwitchRow
            id="setting-weekends-off"
            icon={<OffHoursIcon size={20} />}
            title="Weekends off"
            hint="Saturday and Sunday count as off hours"
            checked={hours.weekendsOff}
            onChange={(weekendsOff) => {
              setWorkHours({ weekendsOff });
            }}
          />
        </>
      )}
    </>
  );
}

type TimeKey = 'start' | 'end' | 'lunchStart' | 'lunchEnd';

interface TimeRangeProps {
  readonly hours: WorkHours;
  readonly from: TimeKey;
  readonly to: TimeKey;
  readonly label: string;
}

/** Two time pickers: from and to. */
function TimeRange({ hours, from, to, label }: TimeRangeProps) {
  const field = (key: TimeKey, which: string) => (
    <Input
      type="time"
      step={300}
      className={styles.time}
      value={hours[key]}
      aria-label={`${label} ${which}`}
      onChange={(e) => {
        if (parseTime(e.target.value) !== null) setWorkHours({ [key]: e.target.value });
      }}
    />
  );
  return (
    <div className={styles.timeRange}>
      {field(from, 'from')}
      <span className={styles.timeDash} aria-hidden>
        –
      </span>
      {field(to, 'to')}
    </div>
  );
}

function ThemeRow() {
  const { resolved } = useTheme();
  return (
    <ChoiceRow
      icon={resolved === 'dark' ? <DarkModeIcon size={20} /> : <LightModeIcon size={20} />}
      title="Theme"
      hint="Day or night, for the page and both scenes"
    >
      <Tabs options={THEMES} value={resolved} onChange={setThemeChoice} label="Theme" stretch />
    </ChoiceRow>
  );
}

/** The skin pack (when there is more than one) and how agents pick a costume from it. */
function CostumeRows() {
  const skins = useSkins();
  return (
    <>
      {skins.packs.length > 1 && (
        <div className={styles.row}>
          <RowText
            icon={<CostumeIcon size={20} />}
            title="Skin pack"
            hint="The art every agent wears"
          />
          <Select
            className={styles.select}
            value={skins.pack?.id ?? ''}
            onChange={skins.setPack}
            label="Skin pack"
            options={skins.packs.map((p) => ({ value: p.id, label: p.manifest.name }))}
          />
        </div>
      )}
      <ChoiceRow
        icon={skins.mode === 'by-agent' ? <DeskModeIcon size={20} /> : <TaskModeIcon size={20} />}
        title="Costume"
        hint={
          skins.pack === null
            ? 'How agents pick a costume'
            : `How agents pick a costume from ${skins.pack.manifest.name}`
        }
      >
        <Tabs
          options={SKIN_MODES}
          value={skins.mode}
          onChange={skins.setMode}
          label="Costume"
          stretch
        />
      </ChoiceRow>
    </>
  );
}
