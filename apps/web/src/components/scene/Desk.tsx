import type { AgentState } from '@agent-office/shared';
import { memo, useMemo } from 'react';
import { cx } from '../../lib/cx';
import { PIXEL } from './pixels';
import { STATE_COLOR_VAR } from '../office/stateMeta';
import type { Cell } from '../worker/sprite';
import type { DeskItem, DeskSide } from './deskSprite';
import {
  ALERT_FRAMES,
  CODE_FRAMES,
  DESK_COLS,
  DESK_ROWS,
  DESK_ROWS_ABOVE,
  SCREEN_GLARE,
  deskRuns,
  mirrorCells,
} from './deskSprite';
import styles from './Desk.module.css';
import type { SceneTheme } from './useSceneTheme';

/** Desk sprite size in CSS px. */
export const DESK_WIDTH = DESK_COLS * PIXEL;
export const DESK_HEIGHT = DESK_ROWS * PIXEL;
/** The anchor (desk-top line) sits this far below the sprite's top edge. */
export const DESK_ANCHOR_Y = DESK_ROWS_ABOVE * PIXEL;
/**
 * A seated worker's body center sits this far above the desk-top line, which puts the
 * desk top at the worker's hands and hides the legs behind the front panel.
 */
export const SEAT_ABOVE_DESK_PX = 30;

type DeskPalette = Readonly<Record<string, string>>;

const DAY: DeskPalette = {
  K: '#3b2a20',
  T: '#d6a066',
  E: '#a8723f',
  P: '#b88049',
  p: '#9a663a',
  x: 'rgba(40, 30, 20, 0.22)',
  d: '#9a663a',
  o: '#f1dcae',
  B: '#2d3240',
  N: '#3a3f4e',
  s: '#1b2131',
  k: '#eceae4',
  m: '#eceae4',
  u: '#f7f4ee',
  h: '#d8d2c6',
  l: '#4f9a52',
  L: '#74c464',
  q: '#c98a5d',
  w: '#fbfaf5',
  g: '#3a4560',
  W: '#ffffff',
};

const NIGHT: DeskPalette = {
  ...DAY,
  K: '#140e0c',
  T: '#8a6444',
  E: '#694a31',
  P: '#73523a',
  p: '#5c412d',
  x: 'rgba(0, 0, 0, 0.35)',
  d: '#5c412d',
  o: '#a08a6a',
  B: '#1a1d27',
  N: '#22252f',
  s: '#0b0e17',
  k: '#8d8b86',
  m: '#8d8b86',
  u: '#a9a59c',
  h: '#86827a',
  l: '#2a5a3b',
  L: '#3a7650',
  q: '#7a5440',
  w: '#b8b6ae',
  g: '#1d2436',
};

interface DeskProps {
  /** Desk-top center, office-relative px. */
  readonly x: number;
  readonly y: number;
  readonly zIndex: number;
  readonly side: DeskSide;
  readonly item: DeskItem;
  /** State of the agent sitting here, or null for an empty desk. */
  readonly state: AgentState | null;
  readonly theme: SceneTheme;
}

function Cells({ cells, colors }: { cells: readonly Cell[]; colors: DeskPalette }) {
  return (
    <>
      {cells.map(([px, py, key]) => (
        <rect key={`${px},${py}`} x={px} y={py} width={1} height={1} fill={colors[key]} />
      ))}
    </>
  );
}

function DeskImpl({ x, y, zIndex, side, item, state, theme }: DeskProps) {
  const runs = useMemo(() => deskRuns(side, item), [side, item]);
  const base = theme === 'night' ? NIGHT : DAY;
  const colors = useMemo<DeskPalette>(
    () => (state === null ? base : { ...base, a: STATE_COLOR_VAR[state] }),
    [base, state],
  );
  const frames = state === 'needs-you' ? ALERT_FRAMES : CODE_FRAMES;

  return (
    <svg
      className={cx(styles.desk, state === 'needs-you' && styles.alert)}
      style={{ left: x - DESK_WIDTH / 2, top: y - DESK_ANCHOR_Y, zIndex }}
      width={DESK_WIDTH}
      height={DESK_HEIGHT}
      viewBox={`0 ${-DESK_ROWS_ABOVE} ${DESK_COLS} ${DESK_ROWS}`}
      shapeRendering="crispEdges"
      aria-hidden
      data-occupied={state === null ? undefined : 'true'}
    >
      {runs.map((r) => (
        <rect key={`${r.x},${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={colors[r.key]} />
      ))}
      {state === null ? (
        <Cells cells={mirrorCells(SCREEN_GLARE, side)} colors={colors} />
      ) : (
        frames.map((frame, i) => (
          <g key={i} className={i === 0 ? styles.frameA : styles.frameB}>
            <Cells cells={mirrorCells(frame, side)} colors={colors} />
          </g>
        ))
      )}
    </svg>
  );
}

export const Desk = memo(DeskImpl);
