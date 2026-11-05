import type { Agent, AgentState } from '@agent-office/shared';
import { SlidingNumber } from '@animate-ui/react/primitives/texts/sliding-number';
import { cx } from '../../lib/cx';
import { STATE_COLOR_VAR, STATE_LABEL } from './stateMeta';
import { STATE_ICON } from '../icons';
import styles from './StateCounts.module.css';

interface StateCountsProps {
  /** The states this panel holds, in the order an agent moves through them. */
  readonly states: readonly AgentState[];
  readonly agents: readonly Agent[];
  /** Agents waiting on you, longest wait first; "Needs you" opens the first. */
  readonly waiting?: readonly Agent[];
  readonly onOpen?: (id: string) => void;
}

/** How many agents are in each state, as small chips in a panel's title bar. */
export function StateCounts({ states, agents, waiting = [], onOpen }: StateCountsProps) {
  return (
    <ul className={styles.counts} aria-label="Agents by state">
      {states.map((state) => {
        const n = agents.filter((a) => a.state === state).length;
        const longest = state === 'needs-you' ? waiting[0] : undefined;
        const Icon = STATE_ICON[state];
        const content = (
          <>
            <Icon size={15} className={styles.icon} style={{ color: STATE_COLOR_VAR[state] }} />
            <span className={styles.label}>{STATE_LABEL[state]}</span>
            <SlidingNumber className={styles.n} number={n} initiallyStable />
          </>
        );
        return (
          <li
            key={state}
            className={cx(styles.stat, n === 0 && styles.zero, n > 0 && longest && styles.urgent)}
            title={`${STATE_LABEL[state]}: ${String(n)}`}
          >
            {longest !== undefined && onOpen !== undefined ? (
              <button
                type="button"
                className={styles.statButton}
                onClick={() => {
                  onOpen(longest.id);
                }}
                title={`Open ${longest.desk}, waiting the longest`}
              >
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}
