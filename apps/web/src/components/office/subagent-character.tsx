import type { Agent, Subagent } from '@agent-office/shared';
import { Tooltip } from '@animate-ui/react/primitives/radix-ui/tooltip';
import { motion, useReducedMotion } from 'motion/react';
import { memo } from 'react';
import { cx } from '../../lib/cx';
import { formatSpanShort } from '../../lib/duration';
import type { Point } from '../../lib/geometry';
import { hueForSession } from '../../lib/hue';
import { useNow } from '../../hooks/use-now';
import { AVATAR_BOX, Avatar } from '../avatar/avatar';
import { STATE_ICON } from '../icons';
import characterStyles from './character.module.css';
import { STATE_COLOR_VAR, STATE_LABEL } from './state-meta';
import styles from './subagent-character.module.css';

const BOX = AVATAR_BOX.mini;
/** The body (below the accessory headroom) is what gets centered on the seat. */
const BODY_CENTER_Y = (BOX.height * 17) / 28;
const FLIGHT_SPRING = { type: 'spring', stiffness: 70, damping: 15, mass: 0.8 } as const;

interface SubagentCharacterProps {
  readonly sub: Subagent;
  readonly parent: Agent;
  /** Seat at its small desk: where the body's center goes, office-relative px. */
  readonly target: Point;
  /** Where it comes from: the agent's own desk, so it hops out of it. */
  readonly from: Point;
  readonly selected?: boolean;
  readonly instant?: boolean;
  readonly onSelect?: (id: string) => void;
}

/**
 * A subagent at its small desk: a smaller copy of the agent that started it (same look),
 * dressed for what it is doing, with its kind on the name tag. It hops out of the agent's
 * desk when it starts. Clicking it opens the agent.
 */
function SubagentCharacterImpl({
  sub,
  parent,
  target,
  from,
  selected = false,
  instant = false,
  onSelect,
}: SubagentCharacterProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const x = target.x - BOX.width / 2;
  const y = target.y - BODY_CENTER_Y;
  const StateIcon = STATE_ICON[sub.state];
  const label = `${sub.type} subagent of ${parent.desk}, ${STATE_LABEL[sub.state]}${
    sub.summary === undefined ? '' : `. Last: ${sub.summary}`
  }`;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <motion.button
          type="button"
          className={cx(characterStyles.character, styles.sub, selected && styles.selected)}
          style={{ zIndex: Math.round(target.y), width: BOX.width, height: BOX.height }}
          initial={{
            x: from.x - BOX.width / 2,
            y: from.y - BODY_CENTER_Y,
            opacity: 0,
            scale: 0.3,
          }}
          animate={{ x, y, opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.3, transition: { duration: 0.3 } }}
          transition={{
            x: reduceMotion || instant ? { duration: 0 } : FLIGHT_SPRING,
            y: reduceMotion || instant ? { duration: 0 } : FLIGHT_SPRING,
            opacity: { duration: 0.25 },
            scale: { duration: 0.35 },
          }}
          onClick={() => onSelect?.(parent.id)}
          aria-label={label}
          data-subagent-id={sub.id}
          data-parent-id={parent.id}
        >
          <span className={cx(characterStyles.shadow, styles.shadow)} aria-hidden />
          <div className={cx(characterStyles.bob, characterStyles.bobTable)}>
            <Avatar
              state={sub.state}
              desk={parent.desk}
              hue={hueForSession(parent.id)}
              seed={parent.id}
              variant="mini"
            />
          </div>
          <span className={styles.tag}>
            <span className={styles.type}>{sub.type}</span>
          </span>
        </motion.button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className={characterStyles.tooltip} side="top" sideOffset={6} aria-hidden>
          <span className={characterStyles.tooltipState}>
            <StateIcon size={15} style={{ color: STATE_COLOR_VAR[sub.state] }} />
            {sub.type} subagent · {STATE_LABEL[sub.state]}
          </span>
          {sub.summary !== undefined && (
            <span className={characterStyles.tooltipLast}>{sub.summary}</span>
          )}
          <SubagentAge since={sub.since} />
          <span className={characterStyles.tooltipHint}>Working for {parent.desk}</span>
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function SubagentAge({ since }: { since: number }) {
  const now = useNow(15_000);
  return (
    <span className={characterStyles.tooltipTiming}>
      Started {formatSpanShort(now - since)} ago
    </span>
  );
}

export const SubagentCharacter = memo(SubagentCharacterImpl);
