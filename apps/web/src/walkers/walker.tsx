import type { Agent, AgentState, Subagent } from '@agent-office/shared';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { CSSProperties, MouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { AVATAR_BOX, Avatar } from '../components/avatar/avatar';
import { ACTIVITY_ICON, STATE_ICON } from '../components/icons';
import { KindBadge } from '../components/office/kind-badge';
import { STATE_COLOR_VAR, STATE_LABEL } from '../components/office/state-meta';
import { cx } from '../lib/cx';
import { hueForSession } from '../lib/hue';
import { unitFromString } from '../lib/seed';
import { useNow } from '../hooks/use-now';
import { activityKind } from '../lib/activity-kind';
import { timingLines } from '../lib/timing';
import { openAgent } from './host';
import styles from './walkers.module.css';

const BOX = AVATAR_BOX.office;
const MINI = AVATAR_BOX.mini;
/** Keeps a banana (and its name tag) on screen. */
const EDGE = 70;
/** How far behind its agent each subagent trails. */
const TRAIL_PX = 48;

interface Pace {
  /** px per second. */
  readonly speed: number;
  /** Pause between walks, ms. */
  readonly pause: readonly [number, number];
}

/** Busy agents bustle about; idle ones amble; those waiting on you or asleep stand still. */
const PACE: Readonly<Partial<Record<AgentState, Pace>>> = {
  called: { speed: 80, pause: [1_500, 4_000] },
  working: { speed: 70, pause: [2_000, 5_000] },
  reading: { speed: 55, pause: [2_500, 6_000] },
  running: { speed: 95, pause: [1_500, 4_000] },
  done: { speed: 45, pause: [3_000, 7_000] },
  idle: { speed: 26, pause: [5_000, 12_000] },
};

/**
 * Moves per second while walking: pixel-art steps rather than smooth frames, which also
 * leaves the GPU nothing to draw between steps (the strip is always on screen).
 */
const STEPS_PER_SECOND = 10;

function between([min, max]: readonly [number, number]): number {
  return min + Math.random() * (max - min);
}

/** Where a banana is headed, and how long it takes to get there (0 to jump). */
interface Leg {
  readonly x: number;
  readonly seconds: number;
}

function clampX(x: number, width: number, edge = EDGE): number {
  return Math.min(Math.max(x, edge), Math.max(edge, width - edge));
}

/**
 * Walks a banana back and forth along the strip: pick a spot, walk there at its pace, stand
 * a while, repeat. Each walk is one CSS transition, so the compositor moves it and the page
 * does no work per frame (the strip is always on screen). Stops when the agent waits on
 * you or falls asleep, once it reaches the spot it was walking to.
 */
function useStroll(id: string, width: number, pace: Pace | undefined) {
  const reduceMotion = useReducedMotion() ?? false;
  const [leg, setLeg] = useState<Leg>(() => ({
    x: clampX(EDGE + unitFromString(id, 'walker-x') * (width - EDGE * 2), width),
    seconds: 0,
  }));
  const [moving, setMoving] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);
  /** Where it is (or will be when this walk ends), and when that walk ends. */
  const at = useRef({ x: leg.x, until: 0 });
  const speed = pace?.speed;
  const pauseMin = pace?.pause[0];
  const pauseMax = pace?.pause[1];

  useEffect(() => {
    // A narrower screen: anyone past the new edge steps back in.
    const inside = clampX(at.current.x, width);
    if (inside !== at.current.x) {
      at.current = { x: inside, until: 0 };
      setLeg({ x: inside, seconds: 0 });
    }
    if (speed === undefined || pauseMin === undefined || pauseMax === undefined || reduceMotion) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pause = (): number => between([pauseMin, pauseMax]);
    const step = (): void => {
      const from = at.current.x;
      // A short stroll more often than a long one, always within the strip.
      const reach = 120 + Math.random() * Math.min(520, width / 2);
      const to = clampX(from + (Math.random() < 0.5 ? -reach : reach), width);
      const seconds = Math.max(0.4, Math.abs(to - from) / speed);
      at.current = { x: to, until: Date.now() + seconds * 1000 };
      setFacingLeft(to < from);
      setMoving(true);
      setLeg({ x: to, seconds });
      timer = setTimeout(() => {
        setMoving(false);
        timer = setTimeout(step, pause());
      }, seconds * 1000);
    };
    // Mid-walk (say, it just finished a step): carry on from where it is headed.
    timer = setTimeout(step, Math.max(0, at.current.until - Date.now()) + pause() * Math.random());
    return () => {
      clearTimeout(timer);
      // It finishes the walk it is on, then stands.
      const left = at.current.until - Date.now();
      if (left <= 0) setMoving(false);
      else
        setTimeout(() => {
          setMoving(false);
        }, left);
    };
  }, [width, speed, pauseMin, pauseMax, reduceMotion]);

  return { leg, moving, facingLeft };
}

interface Slide extends CSSProperties {
  readonly transform: string;
  readonly transition: string;
}

/** Puts an element's center at `x`, gliding there over the leg's time. */
function slide(x: number, halfWidth: number, seconds: number, delay = 0): Slide {
  return {
    transform: `translateX(${String(Math.round(x - halfWidth))}px)`,
    transition:
      seconds > 0
        ? `transform ${String(seconds)}s steps(${String(Math.max(1, Math.round(seconds * STEPS_PER_SECOND)))}, end) ${String(delay)}s`
        : 'none',
  };
}

interface WalkerProps {
  readonly agent: Agent;
  /** Width of the strip, px. */
  readonly width: number;
  /** Right-click: the menu for this agent, where you clicked. */
  readonly onMenu?: (agent: Agent, x: number, y: number) => void;
}

/** A right-click handler that opens the agent's menu instead of the browser's. */
function menuHandler(agent: Agent, onMenu: WalkerProps['onMenu']) {
  return (event: MouseEvent<HTMLElement>): void => {
    event.preventDefault();
    onMenu?.(agent, event.clientX, event.clientY);
  };
}

/** One agent as a banana walking along the bottom of the screen, its subagents in tow. */
export function Walker({ agent, width, onMenu }: WalkerProps): React.JSX.Element {
  const { leg, moving, facingLeft } = useStroll(agent.id, width, PACE[agent.state]);
  const urgent = agent.state === 'needs-you';
  const subs = agent.subagents ?? [];

  return (
    <>
      <AnimatePresence>
        {subs.map((sub, i) => (
          <MiniWalker
            key={sub.id}
            sub={sub}
            parent={agent}
            // Behind the agent, whichever way it faces, a beat later.
            x={clampX(leg.x + (i + 1) * TRAIL_PX * (facingLeft ? 1 : -1), width, EDGE / 2)}
            seconds={leg.seconds}
            delay={0.12 * (i + 1)}
            moving={moving}
            facingLeft={facingLeft}
            onMenu={onMenu}
          />
        ))}
      </AnimatePresence>
      <div className={styles.lane} style={slide(leg.x, BOX.width / 2, leg.seconds)}>
        <motion.button
          type="button"
          className={cx(
            styles.walker,
            urgent && styles.urgent,
            agent.state === 'stale' && styles.asleep,
          )}
          style={{ width: BOX.width, height: BOX.height }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30, transition: { duration: 0.3 } }}
          onClick={() => {
            openAgent(agent.id);
          }}
          onContextMenu={menuHandler(agent, onMenu)}
          aria-label={`${agent.desk}, ${STATE_LABEL[agent.state]}. Open in the dashboard`}
          data-walker
        >
          {urgent && (
            <span className={styles.bubble} aria-hidden>
              !
            </span>
          )}
          <span className={styles.shadow} aria-hidden />
          <span
            className={cx(styles.body, moving && styles.walking, facingLeft && styles.faceLeft)}
          >
            <Avatar
              state={agent.state}
              desk={agent.desk}
              hue={hueForSession(agent.id)}
              seed={agent.id}
              variant="office"
            />
          </span>
          <span className={styles.tag}>
            <KindBadge kind={agent.kind} size={11} />
            <span className={styles.name}>{agent.desk}</span>
          </span>
          <Card agent={agent} />
        </motion.button>
      </div>
    </>
  );
}

/** Shown while you hover a banana: what it is doing, and how long for. */
function Card({ agent }: { agent: Agent }) {
  const now = useNow(15_000);
  const StateIcon = STATE_ICON[agent.state];
  const last = agent.activity[0];
  const LastIcon = last === undefined ? null : ACTIVITY_ICON[activityKind(last)];
  const timing = timingLines(agent, now)[0];
  const subs = agent.subagents?.length ?? 0;
  return (
    <span className={styles.card} aria-hidden>
      <span className={styles.cardState}>
        <StateIcon size={15} style={{ color: STATE_COLOR_VAR[agent.state] }} />
        {agent.desk} · {STATE_LABEL[agent.state]}
      </span>
      {last !== undefined && LastIcon !== null && (
        <span className={styles.cardLast}>
          <LastIcon size={13} />
          {last.summary}
        </span>
      )}
      {timing !== undefined && <span className={styles.cardMuted}>{timing}</span>}
      {subs > 0 && (
        <span className={styles.cardMuted}>
          {subs} subagent{subs === 1 ? '' : 's'} at work
        </span>
      )}
      <span className={styles.cardHint}>Click to open in the dashboard</span>
    </span>
  );
}

interface MiniWalkerProps {
  readonly sub: Subagent;
  readonly parent: Agent;
  /** Where it trots to: just behind its agent. */
  readonly x: number;
  readonly seconds: number;
  readonly delay: number;
  readonly moving: boolean;
  readonly facingLeft: boolean;
  /** Right-clicking a subagent opens its agent's menu. */
  readonly onMenu?: WalkerProps['onMenu'];
}

/** A subagent: a smaller copy of its agent, trotting a little behind it. */
function MiniWalker({
  sub,
  parent,
  x,
  seconds,
  delay,
  moving,
  facingLeft,
  onMenu,
}: MiniWalkerProps) {
  return (
    <div className={styles.lane} style={slide(x, MINI.width / 2, seconds, delay)}>
      <motion.button
        type="button"
        className={cx(styles.walker, styles.mini)}
        style={{ width: MINI.width, height: MINI.height }}
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.3, transition: { duration: 0.3 } }}
        onClick={() => {
          openAgent(parent.id);
        }}
        onContextMenu={menuHandler(parent, onMenu)}
        aria-label={`${sub.type} subagent of ${parent.desk}, ${STATE_LABEL[sub.state]}`}
        title={`${sub.type} subagent · ${STATE_LABEL[sub.state]}${
          sub.summary === undefined ? '' : `\n${sub.summary}`
        }`}
        data-walker
      >
        <span className={cx(styles.shadow, styles.miniShadow)} aria-hidden />
        <span className={cx(styles.body, moving && styles.walking, facingLeft && styles.faceLeft)}>
          <Avatar
            state={sub.state}
            desk={parent.desk}
            hue={hueForSession(parent.id)}
            seed={parent.id}
            variant="mini"
          />
        </span>
        <span className={cx(styles.tag, styles.miniTag)}>{sub.type}</span>
      </motion.button>
    </div>
  );
}
