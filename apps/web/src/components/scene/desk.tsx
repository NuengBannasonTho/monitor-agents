import type { AgentState } from '@agent-office/shared';
import { memo, useMemo } from 'react';
import { cx } from '../../lib/cx';
import { STATE_COLOR_VAR } from '../office/state-meta';
import type { Cell } from '../worker/sprite';
import type { DeskItem, DeskSide, DeskSize } from './desk-art';
import {
  DESK_BOTTOM_PX,
  DESK_TOP_PX,
  DESK_WIDTH_PX,
  MINI_DESK,
  alertFrames,
  codeFrames,
  deskRuns,
  miniDeskRuns,
  screenGlare,
} from './desk-art';
import styles from './desk.module.css';
import type { SceneTheme } from './use-scene-theme';

/**
 * A seated worker's body center sits this far above the desk-top line, which puts the
 * desk top at the worker's hands and hides the legs behind the front panel.
 */
export const SEAT_ABOVE_DESK_PX = 30;
/** The same for a subagent at its small desk. */
export const MINI_SEAT_ABOVE_DESK_PX = 24;

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
  i: '#5c3b20',
  H: '#e8b87f',
  B: '#2d3240',
  N: '#3a3f4e',
  s: '#1b2131',
  G: '#4b5163',
  k: '#eceae4',
  j: '#b9b5ad',
  m: '#eceae4',
  u: '#f7f4ee',
  h: '#d8d2c6',
  c: '#6b3d24',
  l: '#4f9a52',
  L: '#74c464',
  e: '#2f6b3a',
  q: '#c98a5d',
  w: '#fbfaf5',
  v: '#b9c3d6',
  g: '#3a4560',
  W: '#ffffff',
  r: '#c08850',
  F: '#7d522b',
  O: '#161922',
  b: '#4a5164',
  S: '#262d40',
  n: '#5ad17a',
  J: '#a9a59c',
  M: '#bdb8ae',
  U: '#d9d3c7',
  Y: '#5c5650',
  Z: '#1c4a28',
  Q: '#e0a679',
  V: '#cfd3da',
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
  i: '#2e2018',
  H: '#a37a55',
  B: '#1a1d27',
  N: '#22252f',
  s: '#0b0e17',
  G: '#2c303d',
  k: '#8d8b86',
  j: '#6b6964',
  m: '#8d8b86',
  u: '#a9a59c',
  h: '#86827a',
  c: '#3a2216',
  l: '#2a5a3b',
  L: '#3a7650',
  e: '#1b3d29',
  q: '#7a5440',
  w: '#b8b6ae',
  v: '#7d8496',
  g: '#1d2436',
  r: '#7d5a3d',
  F: '#47321f',
  O: '#07080c',
  b: '#2a2f3d',
  S: '#151a28',
  n: '#3fb062',
  J: '#5f5d58',
  M: '#706e69',
  U: '#8a867e',
  Y: '#2a2725',
  Z: '#0d2416',
  Q: '#946850',
  V: '#8f949f',
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
  /** CSS px per art pixel, matching the avatars on screen. */
  readonly px: number;
  /** A full desk, or a subagent's small one. */
  readonly size?: DeskSize;
}

const BOX: Readonly<Record<DeskSize, { width: number; top: number; bottom: number }>> = {
  full: { width: DESK_WIDTH_PX, top: DESK_TOP_PX, bottom: DESK_BOTTOM_PX },
  mini: MINI_DESK,
};

function Cells({ cells, colors }: { cells: readonly Cell[]; colors: DeskPalette }) {
  return (
    <>
      {cells.map(([px, py, key]) => (
        <rect key={`${px},${py}`} x={px} y={py} width={1} height={1} fill={colors[key]} />
      ))}
    </>
  );
}

function DeskImpl({ x, y, zIndex, side, item, state, theme, px, size = 'full' }: DeskProps) {
  const runs = useMemo(
    () => (size === 'mini' ? miniDeskRuns(px) : deskRuns(px, side, item)),
    [px, side, item, size],
  );
  const glare = useMemo(() => screenGlare(px, side, size), [px, side, size]);
  const alert = state === 'needs-you';
  const frames = useMemo(
    () => (alert ? alertFrames(px, side, size) : codeFrames(px, side, size)),
    [alert, px, side, size],
  );
  const box = BOX[size];
  const base = theme === 'night' ? NIGHT : DAY;
  const colors = useMemo<DeskPalette>(
    () => (state === null ? base : { ...base, a: STATE_COLOR_VAR[state] }),
    [base, state],
  );

  return (
    <svg
      className={cx(styles.desk, alert && styles.alert)}
      // Snapped, so a half-width that is not a whole pixel still lands on the scene's grid.
      style={{ left: Math.round((x - box.width / 2) / px) * px, top: y + box.top, zIndex }}
      width={box.width}
      height={box.bottom - box.top}
      viewBox={`0 ${Math.round(box.top / px)} ${Math.round(box.width / px)} ${Math.round((box.bottom - box.top) / px)}`}
      shapeRendering="crispEdges"
      aria-hidden
      data-occupied={state === null ? undefined : 'true'}
    >
      {runs.map((r) => (
        <rect key={`${r.x},${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={colors[r.key]} />
      ))}
      {state === null ? (
        <Cells cells={glare} colors={colors} />
      ) : (
        frames.map((frame, i) => (
          <g key={i} className={i === 0 ? styles.frameA : styles.frameB}>
            <Cells cells={frame} colors={colors} />
          </g>
        ))
      )}
    </svg>
  );
}

export const Desk = memo(DeskImpl);
