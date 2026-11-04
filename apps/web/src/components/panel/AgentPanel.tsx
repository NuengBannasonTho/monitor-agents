import type { Agent } from '@agent-office/shared';
import { CopyButton, CopyButtonIcon } from '@animate-ui/react/primitives/buttons/copy';
import { Drawer } from '@animate-ui/react/primitives/radix-ui/drawer';
import { AnimatePresence, motion } from 'motion/react';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { hueForSession } from '../../lib/hue';
import { formatClock, formatRelative } from '../../lib/relativeTime';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useNow } from '../../lib/useNow';
import { Avatar } from '../avatar/Avatar';
import { CostumePicker } from './CostumePicker';
import { KIND_META } from '../office/kind';
import { STATE_COLOR_VAR, STATE_LABEL } from '../office/stateMeta';
import { activityKeys } from './activityKeys';
import styles from './AgentPanel.module.css';

/** Below this width the panel slides up from the bottom instead of the right. */
export const NARROW_QUERY = '(max-width: 720px)';

interface AgentPanelProps {
  /** The selected agent, or null when nothing is selected (or it was removed). */
  readonly agent: Agent | null;
  readonly onClose: () => void;
}

interface StateVars extends CSSProperties {
  '--state-color': string;
}

/**
 * Non-modal drawer: the office stays visible and clickable, so clicking another
 * character simply switches the panel to that agent.
 */
export function AgentPanel({ agent, onClose }: AgentPanelProps) {
  const narrow = useMediaQuery(NARROW_QUERY);
  // Keep showing the last agent while the drawer animates closed.
  const [shown, setShown] = useState<Agent | null>(agent);
  if (agent !== null && agent !== shown) {
    setShown(agent);
  }

  return (
    <Drawer.Root
      open={agent !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      direction={narrow ? 'bottom' : 'right'}
      modal={false}
    >
      <Drawer.Portal>
        <Drawer.Content className={styles.panel} aria-describedby={undefined}>
          {narrow && <Drawer.Handle className={styles.handle} />}
          {shown !== null && <PanelBody agent={shown} />}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function PanelBody({ agent }: { agent: Agent }) {
  const now = useNow(5_000);
  const kind = KIND_META[agent.kind];
  const keys = activityKeys(agent.activity);
  const stateVars: StateVars = { '--state-color': STATE_COLOR_VAR[agent.state] };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.kind} style={{ background: kind.color }} aria-hidden>
            {kind.badge}
          </span>
          <Drawer.Title className={styles.title}>{agent.desk}</Drawer.Title>
        </div>
        <Drawer.Close className={styles.close} aria-label="Close panel">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </Drawer.Close>
      </header>

      <div className={styles.body} data-vaul-no-drag>
        <section className={styles.hero} style={stateVars} aria-label="Current state">
          <div className={styles.heroSprite}>
            <Avatar
              state={agent.state}
              desk={agent.desk}
              hue={hueForSession(agent.id)}
              seed={agent.id}
              variant="hero"
              title={`${agent.desk} is ${STATE_LABEL[agent.state].toLowerCase()}`}
            />
          </div>
          <div className={styles.heroText}>
            <span className={styles.statePill}>
              <span className={styles.stateDot} aria-hidden />
              {STATE_LABEL[agent.state]}
            </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={keys[0] ?? 'none'}
                className={styles.now}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.12 }}
              >
                {agent.activity[0]?.summary ?? 'No activity yet'}
              </motion.p>
            </AnimatePresence>
            <span className={styles.seen} title={formatClock(agent.lastSeen)}>
              Last event {formatRelative(agent.lastSeen, now)}
            </span>
          </div>
        </section>

        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>Agent</dt>
            <dd>{kind.label}</dd>
          </div>
          <div className={styles.fact}>
            <dt>Desk</dt>
            <dd>{agent.desk}</dd>
          </div>
          <div className={styles.fact}>
            <dt>Folder</dt>
            <dd className={styles.cwd}>
              <code>{agent.cwd}</code>
              <CopyButton className={styles.copy} content={agent.cwd} aria-label="Copy folder path">
                <CopyButtonIcon icon={<CopyIcon />} copiedIcon={<CheckIcon />} />
              </CopyButton>
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>Session</dt>
            <dd>
              <code>{agent.id}</code>
            </dd>
          </div>
        </dl>

        <CostumePicker desk={agent.desk} />

        <section aria-labelledby="activity-title">
          <h3 id="activity-title" className={styles.sectionTitle}>
            Activity <span className={styles.count}>{agent.activity.length}/20</span>
          </h3>
          {agent.activity.length === 0 ? (
            <p className={styles.empty}>Nothing yet. Events appear here as the agent works.</p>
          ) : (
            <ol className={styles.activity}>
              <AnimatePresence initial={false}>
                {agent.activity.map((entry, i) => (
                  <motion.li
                    key={keys[i]}
                    layout="position"
                    className={styles.entry}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22 }}
                  >
                    <span
                      className={styles.entryDot}
                      style={{ background: STATE_COLOR_VAR[entry.state] }}
                      aria-hidden
                    />
                    <span className={styles.entrySummary}>{entry.summary}</span>
                    <time
                      className={styles.entryTime}
                      dateTime={new Date(entry.at).toISOString()}
                      title={formatClock(entry.at)}
                    >
                      {formatRelative(entry.at, now)}
                    </time>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          )}
        </section>
      </div>
    </>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <rect
        x="5"
        y="5"
        width="8.5"
        height="8.5"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M10.5 3.2V3a1.5 1.5 0 0 0-1.5-1.5H3.5A1.5 1.5 0 0 0 2 3v5.5A1.5 1.5 0 0 0 3.5 10h.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
