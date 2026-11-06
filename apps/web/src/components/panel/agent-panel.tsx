import { zoneOf } from '@agent-office/shared';
import type { Agent } from '@agent-office/shared';
import {
  CopyButton,
  CopyButtonIcon,
  useCopyButton,
} from '@animate-ui/react/primitives/buttons/copy';
import { Drawer } from '@animate-ui/react/primitives/radix-ui/drawer';
import { AnimatePresence, motion } from 'motion/react';
import type { CSSProperties } from 'react';
import { useRef, useState } from 'react';
import { hueForSession } from '../../lib/hue';
import { formatClock, formatRelative } from '../../lib/relative-time';
import { editorUrl, resumeCommand } from '../../lib/session-links';
import { timingLines } from '../../lib/timing';
import { useMediaQuery } from '../../hooks/use-media-query';
import { useNow } from '../../hooks/use-now';
import { useElementSize } from '../../hooks/use-element-size';
import { useSkins } from '../../skins/skin-context';
import { Avatar, officePixelSize } from '../avatar/avatar';
import { CityScene } from '../scene/city-scene';
import { ForestScene } from '../scene/forest-scene';
import { useSceneTheme } from '../scene/use-scene-theme';
import { CostumePicker } from './costume-picker';
import { KindBadge } from '../office/kind-badge';
import { KIND_META } from '../office/kind';
import { STATE_COLOR_VAR, STATE_LABEL } from '../office/state-meta';
import { ActivityList } from './activity-list';
import { Composer } from './composer';
import { SubagentList } from './subagent-list';
import { activityKeys } from './activity-keys';
import { buttonLook } from '../ui/button';
import styles from './agent-panel.module.css';
import {
  ActivityIcon,
  AgentIcon,
  CloseIcon,
  CopiedIcon,
  CopyIcon,
  DeskIcon,
  EditorIcon,
  FolderIcon,
  LastEventIcon,
  STATE_ICON,
  SessionIcon,
  TerminalIcon,
  TimerIcon,
  WaitingIcon,
} from '../icons';

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
 * Drawer over the office: it slides in on top of a dimmed backdrop and never resizes the
 * scenes. Click the backdrop, press Escape or use the close button to dismiss it.
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
    >
      <Drawer.Portal>
        <Drawer.Overlay className={styles.overlay} />
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
  // Changes with each new step, so the "now" line can animate in.
  const latestKey = activityKeys(agent.activity)[0] ?? 'none';
  const stateVars: StateVars = {
    '--state-color': STATE_COLOR_VAR[agent.state],
  };
  const resume = resumeCommand(agent);
  const StateIcon = STATE_ICON[agent.state];

  return (
    <>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <KindBadge kind={agent.kind} className={styles.kind} size={19} />
          <Drawer.Title className={styles.title}>{agent.desk}</Drawer.Title>
        </div>
        <Drawer.Close className={styles.close} aria-label="Close panel">
          <CloseIcon size={18} />
        </Drawer.Close>
      </header>

      <div className={styles.body} data-vaul-no-drag>
        <section className={styles.hero} style={stateVars} aria-label="Current state">
          <HeroBanner agent={agent} />
          <div className={styles.heroText}>
            <span className={styles.statePill}>
              <StateIcon size={18} className={styles.stateIcon} />
              {STATE_LABEL[agent.state]}
            </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={latestKey}
                className={styles.now}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.12 }}
              >
                {agent.activity[0]?.summary ?? 'No activity yet'}
              </motion.p>
            </AnimatePresence>
            {timingLines(agent, now).map((line) => (
              <span key={line} className={styles.timing}>
                {line.startsWith('Waiting') ? <WaitingIcon size={14} /> : <TimerIcon size={14} />}
                {line}
              </span>
            ))}
            <span className={styles.seen} title={formatClock(agent.lastSeen)}>
              <LastEventIcon size={14} />
              Last event {formatRelative(agent.lastSeen, now)}
            </span>
          </div>
        </section>

        <div className={styles.actions}>
          <a {...buttonLook('primary', 'md', styles.action)} href={editorUrl(agent.cwd)}>
            <EditorIcon />
            Open in VS Code
          </a>
          {resume !== null && (
            <CopyButton
              {...buttonLook('secondary', 'md', styles.action)}
              content={resume}
              title={resume}
              aria-label="Copy a command that resumes this conversation in a terminal"
            >
              <CopyButtonIcon icon={<TerminalIcon />} copiedIcon={<CopiedIcon />} />
              <CopyLabel idle="Copy resume command" />
            </CopyButton>
          )}
        </div>

        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>
              <AgentIcon size={15} />
              Agent
            </dt>
            <dd className={styles.agentKind}>
              <KindBadge kind={agent.kind} className={styles.factBadge} size={11} />
              {kind.label} · {kind.provider}
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>
              <DeskIcon size={15} />
              Desk
            </dt>
            <dd>{agent.desk}</dd>
          </div>
          <div className={styles.fact}>
            <dt>
              <FolderIcon size={15} />
              Folder
            </dt>
            <dd className={styles.cwd}>
              <code>{agent.cwd}</code>
              <CopyButton className={styles.copy} content={agent.cwd} aria-label="Copy folder path">
                <CopyButtonIcon
                  icon={<CopyIcon size={14} />}
                  copiedIcon={<CopiedIcon size={14} />}
                />
              </CopyButton>
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>
              <SessionIcon size={15} />
              Session
            </dt>
            <dd>
              <code>{agent.id}</code>
            </dd>
          </div>
        </dl>

        <CostumePicker desk={agent.desk} />

        {agent.subagents !== undefined && agent.subagents.length > 0 && (
          <SubagentList subagents={agent.subagents} now={now} />
        )}

        <section aria-labelledby="activity-title">
          <h3 id="activity-title" className={styles.sectionTitle}>
            <ActivityIcon size={18} />
            Activity <span className={styles.count}>{agent.activity.length}/20</span>
          </h3>
          {agent.activity.length === 0 ? (
            <p className={styles.empty}>Nothing yet. Events appear here as the agent works.</p>
          ) : (
            <ActivityList entries={agent.activity} now={now} />
          )}
        </section>
      </div>
      <Composer key={agent.id} agent={agent} />
    </>
  );
}

/**
 * The agent standing in its own corner of the office: the camp (fire, fireflies,
 * butterflies) or the city (drifting clouds, twinkling windows), drawn at the same pixel
 * size as the office so it looks like a window onto it.
 */
function HeroBanner({ agent }: { agent: Agent }) {
  const ref = useRef<HTMLDivElement>(null);
  const size = useElementSize(ref);
  const theme = useSceneTheme();
  const px = officePixelSize(useSkins());
  const zone = zoneOf(agent.state);
  const Scene = zone === 'table' ? CityScene : ForestScene;
  return (
    <div ref={ref} className={styles.banner}>
      {size !== null && size.width > 1 && (
        <div key={zone} className={styles.bannerScene}>
          <Scene width={size.width} height={size.height} theme={theme} px={px} />
        </div>
      )}
      <div className={styles.bannerAvatar} data-zone={zone}>
        <Avatar
          state={agent.state}
          desk={agent.desk}
          hue={hueForSession(agent.id)}
          seed={agent.id}
          variant="office"
          title={`${agent.desk} is ${STATE_LABEL[agent.state].toLowerCase()}`}
        />
      </div>
    </div>
  );
}

/** Button text that confirms the copy for a moment. */
function CopyLabel({ idle }: { idle: string }) {
  const { copied } = useCopyButton();
  return <span>{copied ? 'Copied' : idle}</span>;
}
