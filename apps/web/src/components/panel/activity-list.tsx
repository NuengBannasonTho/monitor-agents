import type { ActivityEntry } from '@agent-office/shared';
import { Accordion } from '@animate-ui/react/primitives/radix-ui/accordion';
import { AnimatePresence, motion } from 'motion/react';
import { formatClock, formatRelative } from '../../lib/relative-time';
import { activityKind } from '../../lib/activity-kind';
import { ACTIVITY_ICON, ExpandIcon } from '../icons';
import { ActivityDetail } from './activity-detail';
import { activityKeys } from './activity-keys';
import styles from './activity-list.module.css';

interface ActivityListProps {
  readonly entries: readonly ActivityEntry[];
  readonly now: number;
}

/**
 * The agent's steps, newest first, one line each. Open a line to see everything behind it:
 * the command and its output, the diff, the prompt or Claude's reply. Several can be open.
 */
export function ActivityList({ entries, now }: ActivityListProps): React.JSX.Element {
  const keys = activityKeys(entries);
  // A server recording details gives most lines one; an older one gives none at all.
  const recording = entries.some((e) => e.detail !== undefined);
  return (
    <Accordion.Root type="multiple" asChild>
      <ol className={styles.list}>
        <AnimatePresence initial={false}>
          {entries.map((entry, i) => {
            const key = keys[i] ?? String(i);
            return (
              <Accordion.Item key={key} value={key} asChild>
                <motion.li
                  layout="position"
                  className={styles.entry}
                  data-failed={entry.failed === true ? 'true' : undefined}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                >
                  <Accordion.Header asChild>
                    <div>
                      <Accordion.Trigger className={styles.trigger}>
                        <EntryIcon entry={entry} />
                        <span className={styles.summary}>{entry.summary}</span>
                        <time
                          className={styles.time}
                          dateTime={new Date(entry.at).toISOString()}
                          title={formatClock(entry.at)}
                        >
                          {formatRelative(entry.at, now)}
                        </time>
                        <ExpandIcon size={14} className={styles.chevron} />
                      </Accordion.Trigger>
                    </div>
                  </Accordion.Header>
                  <Accordion.Content className={styles.content}>
                    <ActivityDetail entry={entry} recording={recording} />
                  </Accordion.Content>
                </motion.li>
              </Accordion.Item>
            );
          })}
        </AnimatePresence>
      </ol>
    </Accordion.Root>
  );
}

/** The line's icon: what kind of step it was. */
function EntryIcon({ entry }: { entry: ActivityEntry }) {
  const Icon = ACTIVITY_ICON[activityKind(entry)];
  return (
    <span className={styles.icon}>
      <Icon size={15} />
    </span>
  );
}
