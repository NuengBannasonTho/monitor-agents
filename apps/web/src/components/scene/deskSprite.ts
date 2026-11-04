import type { Cell, Run } from '../worker/sprite';
import { rowsToRuns } from '../worker/sprite';

/**
 * Front view of a computer desk, 20 x 12 cells at the worker's pixel size. The agent sits
 * behind it: the desk is drawn in front of the character, so the desk top hides the hands
 * and the front panel hides the legs. The monitor is short and stands at one end, so the
 * face stays visible for pixel workers and for image skins (whose faces sit lower).
 *
 * Rows -5..-1 are above the desk top (monitor, mug), rows 0..6 are the desk itself.
 *
 * Keys: K outline · T top · E top edge · P panel · p panel shade · x floor shadow
 *       d drawer seam · o knob · B bezel · N stand base · s screen
 *       k keyboard · m mouse · u mug · h mug handle
 *       l leaf · L leaf light · q pot · w paper
 */
export const DESK_COLS = 20;
export const DESK_ROWS_ABOVE = 5;
export const DESK_ROWS = 12;

export type DeskSide = 'left' | 'right';
export type DeskItem = 'mug' | 'plant' | 'papers' | 'none';
export const DESK_ITEMS: readonly DeskItem[] = ['mug', 'plant', 'papers', 'none'];

const BASE: readonly string[] = [
  'KTTTTTTTTTTTTTTTTTTK',
  'KEEEEEEEEEEEEEEEEEEK',
  '.KPPPPPPPPPPdPPPPPK.',
  '.KPPPPPPPPPPdPPoPPK.',
  '.KppppppppppdpppppK.',
  '.KK..............KK.',
  '..xxxxxxxxxxxxxxxx..',
];

/** Monitor at cols 0..7, rows -5..-1. Screen is cols 1..6, rows -4..-2. */
const MONITOR: readonly string[] = ['BBBBBBBB', 'BssssssB', 'BssssssB', 'BssssssB', 'BBBBBBBB'];

const ITEMS: Readonly<Record<DeskItem, readonly string[]>> = {
  // Cols 16..19, rows -3..-1.
  mug: ['....', '.uuh', '.uuh'],
  plant: ['.lL.', 'lLll', '.qq.'],
  papers: ['....', '..ww', '.www'],
  none: ['....', '....', '....'],
};

function put(grid: string[][], x: number, y: number, key: string): void {
  const row = grid[y + DESK_ROWS_ABOVE];
  if (row !== undefined && x >= 0 && x < DESK_COLS && key !== '.') row[x] = key;
}

function stamp(grid: string[][], rows: readonly string[], x0: number, y0: number): void {
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) put(grid, x0 + dx, y0 + dy, row.charAt(dx));
  });
}

/** Full sprite rows (top = row -DESK_ROWS_ABOVE). The monitor sits on `side`. */
export function composeDesk(side: DeskSide, item: DeskItem): string[] {
  const grid = Array.from({ length: DESK_ROWS }, () =>
    Array.from({ length: DESK_COLS }, () => '.'),
  );
  stamp(grid, BASE, 0, 0);
  stamp(grid, MONITOR, 0, -DESK_ROWS_ABOVE);
  stamp(grid, ['NNNN'], 2, 0); // stand base on the desk top
  stamp(grid, ['kkkkkk'], 8, 0);
  put(grid, 15, 0, 'm');
  stamp(grid, ITEMS[item], 16, -3);
  const rows = grid.map((r) => r.join(''));
  if (side === 'left') return rows;
  return rows.map((r) => {
    let mirrored = '';
    for (let i = r.length - 1; i >= 0; i--) mirrored += r.charAt(i);
    return mirrored;
  });
}

export function deskRuns(side: DeskSide, item: DeskItem): Run[] {
  // rowsToRuns counts rows from 0; shift them back so y matches the viewBox.
  return rowsToRuns(composeDesk(side, item)).map((r) => ({ ...r, y: r.y - DESK_ROWS_ABOVE }));
}

/* ---- screen content (cells in the left-side layout; mirrored for the right) ---- */

const SCREEN_X0 = 1;
const SCREEN_X1 = 6;
const SCREEN_Y0 = -4;
const SCREEN_Y1 = -2;

function line(y: number, from: number, to: number, key: string): Cell[] {
  const cells: Cell[] = [];
  for (let x = from; x <= to; x++) cells.push([x, y, key]);
  return cells;
}

/** Two frames of "code" scrolling by, drawn in the agent's state color ('a'). */
export const CODE_FRAMES: readonly (readonly Cell[])[] = [
  [...line(-4, 1, 3, 'a'), ...line(-3, 2, 5, 'a'), ...line(-2, 1, 4, 'a')],
  [...line(-4, 1, 4, 'a'), ...line(-3, 2, 3, 'a'), [5, -3, 'a'], ...line(-2, 1, 2, 'a')],
];

function fill(key: string): Cell[] {
  const cells: Cell[] = [];
  for (let y = SCREEN_Y0; y <= SCREEN_Y1; y++) cells.push(...line(y, SCREEN_X0, SCREEN_X1, key));
  return cells;
}

const BANG: readonly Cell[] = [
  [3, -4, 'W'],
  [4, -4, 'W'],
  [3, -2, 'W'],
  [4, -2, 'W'],
];

/** Needs-you: the screen flashes red with a "!". */
export const ALERT_FRAMES: readonly (readonly Cell[])[] = [
  [...fill('a'), ...BANG],
  BANG.map(([x, y]): Cell => [x, y, 'a']),
];

/** Glare on a switched-off screen. */
export const SCREEN_GLARE: readonly Cell[] = [
  [1, -4, 'g'],
  [2, -4, 'g'],
  [1, -3, 'g'],
];

export function mirrorCells(cells: readonly Cell[], side: DeskSide): readonly Cell[] {
  return side === 'left' ? cells : cells.map(([x, y, k]): Cell => [DESK_COLS - 1 - x, y, k]);
}
