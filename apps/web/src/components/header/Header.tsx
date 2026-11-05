import type { Agent } from '@agent-office/shared';
import type { AlertPermission } from '../../live/useDesktopAlerts';
import { BananaLogo } from './BananaLogo';
import { HeaderSwitch } from './HeaderSwitch';
import { SkinSwitcher } from './SkinSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';
import { AlertsIcon, FinishedIcon, SoundIcon } from '../icons';
import styles from './Header.module.css';

interface HeaderProps {
  /** Agents waiting on you, longest wait first. */
  readonly waiting: readonly Agent[];
  /** Finished turns you have not opened yet, oldest first. */
  readonly finished: readonly Agent[];
  /** Opens an agent's details. */
  readonly onOpen: (id: string) => void;
  /** Where data comes from: the server stream status, or the static preview. */
  readonly source: 'preview' | 'connecting' | 'live' | 'offline';
  readonly sound: { readonly enabled: boolean; readonly setEnabled: (value: boolean) => void };
  readonly alerts: {
    readonly enabled: boolean;
    readonly permission: AlertPermission;
    readonly setEnabled: (value: boolean) => void;
  };
}

const ALERTS_HINT: Readonly<Record<AlertPermission, string>> = {
  default:
    'Show a desktop notification when an agent needs you or finishes, while this tab is in the background',
  granted:
    'Show a desktop notification when an agent needs you or finishes, while this tab is in the background',
  denied: 'Notifications are blocked for this page. Allow them in your browser’s site settings.',
  unsupported: 'This browser cannot show desktop notifications',
};

const SOURCE_LABEL: Readonly<Record<HeaderProps['source'], string>> = {
  preview: 'Preview',
  connecting: 'Connecting',
  live: 'Live',
  offline: 'Offline',
};

const SOURCE_HINT: Readonly<Record<HeaderProps['source'], string>> = {
  preview: 'Simulated agents running in your browser',
  connecting: 'Connecting to the MO BANANA server',
  live: 'Connected to the MO BANANA server',
  offline: 'Server not reachable. Start it with pnpm start; reconnecting automatically.',
};

/** Brand and connection on the left; unread finishes and the controls on the right. */
export function Header({ waiting, finished, onOpen, source, sound, alerts }: HeaderProps) {
  const needsYou = waiting.length;

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <BananaLogo />
        <h1 className={styles.title}>MO BANANA</h1>
        <span
          className={styles.source}
          data-source={source}
          title={SOURCE_HINT[source]}
          role="status"
        >
          <span className={styles.sourceDot} aria-hidden />
          {SOURCE_LABEL[source]}
        </span>
      </div>

      <p className="visually-hidden" aria-live="polite">
        {needsYou === 0
          ? 'No agents need you'
          : `${String(needsYou)} agent${needsYou === 1 ? '' : 's'} need you`}
      </p>
      {finished[0] !== undefined && (
        <button
          type="button"
          className={styles.finished}
          onClick={() => {
            if (finished[0] !== undefined) onOpen(finished[0].id);
          }}
          title={`Finished, not opened yet: ${finished.map((a) => a.desk).join(', ')}`}
        >
          <FinishedIcon size={18} className={styles.check} />
          {finished.length === 1
            ? `${finished[0].desk} finished`
            : `${String(finished.length)} finished`}
        </button>
      )}

      <div className={styles.controls}>
        <HeaderSwitch
          id="needs-you-sound"
          label="Sound"
          icon={<SoundIcon />}
          hint="Play a chime when an agent needs you"
          enabled={sound.enabled}
          onChange={sound.setEnabled}
        />
        {alerts.permission !== 'unsupported' && (
          <HeaderSwitch
            id="desktop-alerts"
            label="Alerts"
            icon={<AlertsIcon />}
            hint={ALERTS_HINT[alerts.permission]}
            enabled={alerts.enabled}
            disabled={alerts.permission === 'denied'}
            onChange={alerts.setEnabled}
          />
        )}
        <SkinSwitcher />
        <ThemeSwitcher />
      </div>
    </header>
  );
}
