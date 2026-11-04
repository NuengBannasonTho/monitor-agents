import type { Agent, Zone } from '@agent-office/shared';
import { Tooltip } from '@animate-ui/react/primitives/radix-ui/tooltip';
import { motion, useAnimate, useReducedMotion } from 'motion/react';
import type { CSSProperties } from 'react';
import { memo, useEffect, useRef } from 'react';
import { cx } from '../../lib/cx';
import type { Point } from '../../lib/geometry';
import { hueForSession } from '../../lib/hue';
import { unitFromString } from '../../lib/seed';
import type { Rect } from '../../lib/useZoneRects';
import { AVATAR_BOX, Avatar } from '../avatar/Avatar';
import styles from './Character.module.css';
import { KIND_META } from './kind';
import { STATE_COLOR_VAR, STATE_LABEL } from './stateMeta';
import { useWander } from './useWander';

export const CHARACTER_WIDTH = AVATAR_BOX.office.width;
export const CHARACTER_HEIGHT = AVATAR_BOX.office.height;
/** The body (below the accessory headroom) is what gets centered on the target. */
const BODY_CENTER_Y = (CHARACTER_HEIGHT * 17) / 28;

interface CharacterProps {
  readonly agent: Agent;
  readonly zone: Zone;
  /** Home spot (seat or lounge slot): where the body's center goes, office-relative px. */
  readonly target: Point;
  /** Area to stroll around in while waiting, or null to stay put. */
  readonly wanderArea?: Rect | null;
  readonly selected?: boolean;
  readonly onSelect?: (id: string) => void;
}

interface BobVars extends CSSProperties {
  '--bob-delay': string;
}

const FLIGHT_SPRING = { type: 'spring', stiffness: 55, damping: 14, mass: 1 } as const;
/** Walking speed in px/s; finished agents stroll a little faster. */
const WALK_SPEED = { idle: 38, done: 52 } as const;

function CharacterImpl({
  agent,
  zone,
  target,
  wanderArea = null,
  selected = false,
  onSelect,
}: CharacterProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const [hopScope, animateHop] = useAnimate<HTMLDivElement>();
  const prevZone = useRef(zone);
  const hue = hueForSession(agent.id);
  const kind = KIND_META[agent.kind];

  // Waiting agents walk around the lounge; stale ones are asleep and stay put.
  const canWalk =
    zone === 'lounge' && wanderArea !== null && !reduceMotion && agent.state !== 'stale';
  const wander = useWander(
    canWalk,
    wanderArea,
    agent.state === 'done' ? WALK_SPEED.done : WALK_SPEED.idle,
  );
  const center = wander.leg?.to ?? target;
  const x = center.x - CHARACTER_WIDTH / 2;
  const y = center.y - BODY_CENTER_Y;
  const position = reduceMotion
    ? { duration: 0 }
    : wander.leg !== null
      ? { type: 'tween' as const, ease: 'linear' as const, duration: wander.leg.duration }
      : FLIGHT_SPRING;

  // A little "lift-off" arc while flying between zones.
  useEffect(() => {
    if (prevZone.current === zone) return;
    prevZone.current = zone;
    if (reduceMotion) return;
    // Lift only, no rotation: rotated pixel art loses its crisp edges.
    void animateHop(
      hopScope.current,
      { y: [0, -44, -10, 0], scale: [1, 1.08, 1.03, 1] },
      { duration: 1.1, ease: 'easeInOut' },
    );
  }, [zone, reduceMotion, animateHop, hopScope]);

  const bobVars: BobVars = {
    '--bob-delay': `${(-unitFromString(agent.id, 'bobd') * 4).toFixed(2)}s`,
  };

  const lastSummary = agent.activity[0]?.summary;
  const label = `${agent.desk}, ${kind.label}, ${STATE_LABEL[agent.state]}${
    lastSummary === undefined ? '' : `. Last: ${lastSummary}`
  }`;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <motion.button
          type="button"
          className={cx(
            styles.character,
            agent.state === 'needs-you' && styles.urgent,
            selected && styles.selected,
          )}
          style={{ zIndex: Math.round(center.y), width: CHARACTER_WIDTH, height: CHARACTER_HEIGHT }}
          initial={{ x, y, opacity: 0, scale: 0.4 }}
          animate={{ x, y, opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.4, transition: { duration: 0.3 } }}
          transition={{
            x: position,
            y: position,
            opacity: { duration: 0.25 },
            scale: { duration: 0.35 },
          }}
          onAnimationComplete={() => {
            if (canWalk) wander.arrive(center);
          }}
          onClick={() => onSelect?.(agent.id)}
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={selected}
          data-agent-id={agent.id}
          data-zone={zone}
          data-walking={wander.moving ? 'true' : undefined}
        >
          <span className={styles.shadow} aria-hidden />
          <div ref={hopScope} className={styles.hop}>
            <div
              className={cx(
                styles.bob,
                zone === 'table' && styles.bobTable,
                wander.moving && styles.walking,
                wander.facingLeft && styles.faceLeft,
              )}
              style={bobVars}
            >
              <Avatar
                state={agent.state}
                desk={agent.desk}
                hue={hue}
                seed={agent.id}
                variant="office"
              />
            </div>
          </div>
          <span className={styles.tag}>
            <span className={styles.kind} style={{ background: kind.color }} aria-hidden>
              {kind.badge}
            </span>
            <span className={styles.desk}>{agent.desk}</span>
          </span>
        </motion.button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className={styles.tooltip} side="top" sideOffset={8} aria-hidden>
          <span className={styles.tooltipState}>
            <span
              className={styles.tooltipDot}
              style={{ background: STATE_COLOR_VAR[agent.state] }}
            />
            {STATE_LABEL[agent.state]}
          </span>
          {lastSummary !== undefined && <span className={styles.tooltipLast}>{lastSummary}</span>}
          <span className={styles.tooltipHint}>Click for details</span>
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export const Character = memo(CharacterImpl);
