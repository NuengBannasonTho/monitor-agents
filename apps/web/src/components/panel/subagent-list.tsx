import type { Subagent } from '@agent-office/shared';
import { formatSpanShort } from '../../lib/duration';
import { STATE_ICON, SubagentIcon } from '../icons';
import { STATE_COLOR_VAR, STATE_LABEL } from '../office/state-meta';
import styles from './subagent-list.module.css';

/** The subagents this agent has at work, each with what it is doing and for how long. */
export function SubagentList({ subagents, now }: { subagents: readonly Subagent[]; now: number }) {
  return (
    <section aria-labelledby="subagents-title">
      <h3 id="subagents-title" className={styles.title}>
        <SubagentIcon size={18} />
        Subagents <span className={styles.count}>{subagents.length}</span>
      </h3>
      <ul className={styles.list}>
        {subagents.map((s) => {
          const Icon = STATE_ICON[s.state];
          return (
            <li key={s.id} className={styles.item}>
              <Icon size={16} style={{ color: STATE_COLOR_VAR[s.state] }} />
              <span className={styles.main}>
                <span className={styles.head}>
                  <strong>{s.type}</strong>
                  <span className={styles.state}>{STATE_LABEL[s.state]}</span>
                </span>
                {s.summary !== undefined && <span className={styles.step}>{s.summary}</span>}
              </span>
              <span className={styles.age} title="Working for">
                {formatSpanShort(now - s.since)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
