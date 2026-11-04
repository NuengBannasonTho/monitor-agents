import { AGENT_STATES } from '@agent-office/shared';
import type { Agent, AgentState } from '@agent-office/shared';
import { SlidingNumber } from '@animate-ui/react/primitives/texts/sliding-number';
import { useMemo } from 'react';
import { cx } from '../../lib/cx';
import { BananaLogo } from './BananaLogo';
import { SkinSwitcher } from './SkinSwitcher';
import { SoundToggle } from './SoundToggle';
import { STATE_COLOR_VAR, STATE_LABEL } from '../office/stateMeta';
import styles from './Header.module.css';

interface HeaderProps {
  readonly agents: readonly Agent[];
  /** Where data comes from: the server stream status, or the static preview. */
  readonly source: 'preview' | 'connecting' | 'live' | 'offline';
  readonly sound: { readonly enabled: boolean; readonly setEnabled: (value: boolean) => void };
}

const SOURCE_HINT: Readonly<Record<HeaderProps['source'], string>> = {
  preview: 'Simulated agents running in your browser',
  connecting: 'Connecting to the Agent Office server',
  live: 'Connected to the Agent Office server',
  offline: 'Server not reachable. Start it with pnpm start; reconnecting automatically.',
};

export function countByState(agents: readonly Agent[]): Record<AgentState, number> {
  const counts: Record<AgentState, number> = {
    idle: 0,
    called: 0,
    working: 0,
    reading: 0,
    running: 0,
    'needs-you': 0,
    done: 0,
    stale: 0,
  };
  for (const a of agents) counts[a.state] += 1;
  return counts;
}

export function Header({ agents, source, sound }: HeaderProps) {
  const counts = useMemo(() => countByState(agents), [agents]);
  const needsYou = counts['needs-you'];

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <BananaLogo />
        <h1 className={styles.title}>Agent Office</h1>
        <span
          className={styles.source}
          data-source={source}
          title={SOURCE_HINT[source]}
          role="status"
        >
          {source}
        </span>
      </div>

      <ul className={styles.counts} aria-label="Agents by state">
        {AGENT_STATES.map((state) => {
          const n = counts[state];
          const urgent = state === 'needs-you' && n > 0;
          return (
            <li
              key={state}
              className={cx(styles.pill, n === 0 && styles.zero, urgent && styles.urgent)}
              data-state={state}
              title={`${STATE_LABEL[state]}: ${n}`}
            >
              <span
                className={styles.dot}
                style={{ background: STATE_COLOR_VAR[state] }}
                aria-hidden
              />
              <span className={styles.label}>{STATE_LABEL[state]}</span>
              <SlidingNumber className={styles.n} number={n} initiallyStable />
            </li>
          );
        })}
      </ul>

      <p className="visually-hidden" aria-live="polite">
        {needsYou === 0
          ? 'No agents need you'
          : `${needsYou} agent${needsYou === 1 ? '' : 's'} need you`}
      </p>
      <div className={styles.controls}>
        <SoundToggle enabled={sound.enabled} onChange={sound.setEnabled} />
        <SkinSwitcher />
      </div>
    </header>
  );
}
