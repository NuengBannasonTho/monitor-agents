import type { AgentState } from '@agent-office/shared';
import { useReducedMotion } from 'motion/react';
import { memo, useMemo } from 'react';
import { cx } from '../../lib/cx';
import { workerPalette } from './palette';
import type { PaletteMap } from './palette';
import styles from './PixelWorker.module.css';
import {
  ACCESSORY_ROWS,
  ALERT,
  BODY,
  DOCUMENT,
  SPRITE_COLS,
  SPRITE_ROWS,
  TERMINAL,
  TERMINAL_CURSOR,
  ZZZ,
  faceFor,
  rowsToRuns,
} from './sprite';
import type { Cell } from './sprite';
import { useSeededBlink } from './useSeededBlink';

/** Total grid height including accessory headroom. */
export const WORKER_GRID_ROWS = SPRITE_ROWS + ACCESSORY_ROWS;
/** Height / width ratio of the rendered SVG. */
export const WORKER_ASPECT = WORKER_GRID_ROWS / SPRITE_COLS;

export interface PixelWorkerProps {
  readonly state: AgentState;
  /** Shirt hue in degrees; see hueForSession(). */
  readonly hue: number;
  /** Rendered width in px. Multiples of 18 keep every pixel perfectly square. */
  readonly size: number;
  /** Seeds hair/skin variety and the blink rhythm. */
  readonly seed?: string;
  /** Accessible label. When omitted the SVG is decorative (aria-hidden). */
  readonly title?: string;
}

const BODY_RUNS = rowsToRuns(BODY);

const STATE_CLASS: Partial<Record<AgentState, string>> = {
  working: styles.typing,
  'needs-you': styles.bounce,
  done: styles.hop,
  stale: styles.stale,
};

function Cells({ cells, palette }: { cells: readonly Cell[]; palette: PaletteMap }) {
  return (
    <>
      {cells.map(([x, y, key]) => (
        <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill={palette[key]} />
      ))}
    </>
  );
}

function PixelWorkerImpl({ state, hue, size, seed, title }: PixelWorkerProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const seedKey = seed ?? `hue-${hue}`;
  const blinks = state === 'idle' || state === 'called' || state === 'running';
  const blinking = useSeededBlink(seedKey, blinks && !reduceMotion);
  const palette = useMemo(() => workerPalette(hue, seedKey), [hue, seedKey]);
  const face = faceFor(state, blinking);

  return (
    <svg
      className={cx(styles.worker, STATE_CLASS[state])}
      width={size}
      height={size * WORKER_ASPECT}
      viewBox={`0 ${-ACCESSORY_ROWS} ${SPRITE_COLS} ${WORKER_GRID_ROWS}`}
      shapeRendering="crispEdges"
      role={title === undefined ? undefined : 'img'}
      aria-hidden={title === undefined ? true : undefined}
      aria-label={title}
      data-state={state}
    >
      <g className={styles.body}>
        {BODY_RUNS.map((r) => (
          <rect
            key={`${r.x},${r.y}`}
            x={r.x}
            y={r.y}
            width={r.w}
            height={1}
            fill={palette[r.key]}
          />
        ))}
        {state === 'reading' && <Cells cells={DOCUMENT} palette={palette} />}
        <g key={state} className={styles.faceEnter}>
          <Cells cells={face.cells} palette={palette} />
          {face.drifting !== undefined && (
            <g className={styles.pupils}>
              <Cells cells={face.drifting} palette={palette} />
            </g>
          )}
        </g>
      </g>

      {state === 'running' && (
        <g className={styles.float}>
          <Cells cells={TERMINAL} palette={palette} />
          <g className={styles.cursor}>
            <Cells cells={TERMINAL_CURSOR} palette={palette} />
          </g>
        </g>
      )}
      {state === 'needs-you' && (
        <g className={styles.alert}>
          <Cells cells={ALERT} palette={palette} />
        </g>
      )}
      {state === 'stale' && (
        <g className={styles.float}>
          <Cells cells={ZZZ} palette={palette} />
        </g>
      )}
    </svg>
  );
}

export const PixelWorker = memo(PixelWorkerImpl);
