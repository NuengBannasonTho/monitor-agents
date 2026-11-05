import type { Cell, Run } from '../worker/sprite';
import { rowsToRuns } from '../worker/sprite';
import { hash2 } from './pixels';

/**
 * Front view of a computer desk, 100 x 70 CSS px, drawn at any pixel size. The agent sits
 * behind it: the desk covers the hands and legs, and the short monitor stands at one end so
 * the face stays visible. y = 0 is the desk-top line; the art spans y = -30 .. 40.
 *
 * Keys: K outline · T top · H top highlight · E top edge · F edge underside · r wood grain
 *       P panel · p panel shade · x floor shadow · d drawer seam · o knob · i handle
 *       O monitor outline · B bezel · b bezel light · s screen · S screen sheen · G glare
 *       n power light · N stand · k keyboard · j key · J keyboard shade · m mouse
 *       M mouse shade · u mug · U mug shade · h handle · c coffee · Y light outline
 *       l leaf · L leaf light · e leaf dark · Z leaf outline · q pot · Q pot rim
 *       w paper · v paper line · V paper edge
 */
export const DESK_WIDTH_PX = 100;
export const DESK_TOP_PX = -30;
export const DESK_BOTTOM_PX = 40;

export type DeskSide = 'left' | 'right';
export type DeskItem = 'mug' | 'plant' | 'papers' | 'none';
export const DESK_ITEMS: readonly DeskItem[] = ['mug', 'plant', 'papers', 'none'];

/** Screen area in the left-monitor layout, CSS px. */
const SCREEN = { x0: 5, x1: 35, y0: -20, y1: -5 } as const;

interface Grid {
  readonly px: number;
  readonly cols: number;
  readonly rows: number;
  readonly cells: string[][];
}

function toArt(css: number, px: number): number {
  return Math.round(css / px);
}

function makeGrid(px: number): Grid {
  const cols = toArt(DESK_WIDTH_PX, px);
  const rows = toArt(DESK_BOTTOM_PX - DESK_TOP_PX, px);
  return {
    px,
    cols,
    rows,
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => '.')),
  };
}

/** Fills a CSS-px rectangle (relative to the desk-top line) with a key. */
function fill(g: Grid, x: number, y: number, w: number, h: number, key: string): void {
  const x0 = toArt(x, g.px);
  const y0 = toArt(y - DESK_TOP_PX, g.px);
  const x1 = Math.max(x0 + 1, toArt(x + w, g.px));
  const y1 = Math.max(y0 + 1, toArt(y + h - DESK_TOP_PX, g.px));
  for (let r = Math.max(0, y0); r < Math.min(g.rows, y1); r++) {
    const row = g.cells[r];
    if (row === undefined) continue;
    for (let c = Math.max(0, x0); c < Math.min(g.cols, x1); c++) row[c] = key;
  }
}

function mirrorRow(row: string): string {
  let out = '';
  for (let i = row.length - 1; i >= 0; i--) out += row.charAt(i);
  return out;
}

/** Full sprite rows, top row = DESK_TOP_PX. The monitor sits on `side`. */
export function composeDesk(px: number, side: DeskSide, item: DeskItem): string[] {
  const rows = px <= 3 ? composeFine(px, item) : composeCoarse(px, item);
  return side === 'left' ? rows : rows.map(mirrorRow);
}

/** Outline color for the part a key belongs to. */
function outlineFor(key: string): string {
  if ('BbsSGnNkjJmM'.includes(key)) return 'O';
  if ('lLe'.includes(key)) return 'Z';
  if ('uUhcwvV'.includes(key)) return 'Y';
  return 'K';
}

/** Every empty cell touching a part (4-neighbour) becomes that part's outline. */
function outline(g: Grid): void {
  const at = (r: number, c: number): string => g.cells[r]?.[c] ?? '.';
  const marks: [number, number, string][] = [];
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (at(r, c) !== '.') continue;
      for (const [dr, dc] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ] as const) {
        const k = at(r + dr, c + dc);
        if (k !== '.' && k !== 'x') {
          marks.push([r, c, outlineFor(k)]);
          break;
        }
      }
    }
  }
  for (const [r, c, k] of marks) {
    const row = g.cells[r];
    if (row !== undefined) row[c] = k;
  }
}

/** Like `fill`, but only where nothing is drawn yet. */
function under(g: Grid, x: number, y: number, w: number, h: number, key: string): void {
  const x0 = toArt(x, g.px);
  const y0 = toArt(y - DESK_TOP_PX, g.px);
  const x1 = Math.max(x0 + 1, toArt(x + w, g.px));
  const y1 = Math.max(y0 + 1, toArt(y + h - DESK_TOP_PX, g.px));
  for (let r = Math.max(0, y0); r < Math.min(g.rows, y1); r++) {
    const row = g.cells[r];
    if (row === undefined) continue;
    for (let c = Math.max(0, x0); c < Math.min(g.cols, x1); c++) if (row[c] === '.') row[c] = key;
  }
}

/** Sets one art cell at CSS (x, y) relative to the desk-top line. */
function dot(g: Grid, x: number, y: number, key: string): void {
  const row = g.cells[toArt(y - DESK_TOP_PX, g.px)];
  const c = toArt(x, g.px);
  if (row !== undefined && c >= 0 && c < g.cols) row[c] = key;
}

/** Small pixels: shaded wood, a bevelled front panel, a monitor with a lit bezel. */
function composeFine(px: number, item: DeskItem): string[] {
  const g = makeGrid(px);
  const u = px;

  // Tabletop: lit top row, grain, front edge, shadowed underside.
  fill(g, 2, 0, 96, 10, 'T');
  fill(g, 2, 0, 96, u, 'H');
  for (let x = 4; x < 96; x += u) {
    for (let y = 2 * u; y < 6; y += u) {
      if (
        hash2(Math.round(x / u / 5), Math.round(y / u) * 7 + (Math.round(x / u) % 5), 31) < 0.22
      ) {
        dot(g, x, y, 'r');
      }
    }
  }
  fill(g, 2, 6, 96, u, 'E');
  fill(g, 2, 8, 96, u, 'F');

  // Front panel with two bevelled insets and a drawer handle.
  fill(g, 4, 10, 92, 16, 'P');
  for (const [x0, x1] of [
    [8, 58],
    [62, 92],
  ] as const) {
    fill(g, x0, 12, x1 - x0, u, 'p');
    fill(g, x0, 12, u, 10, 'p');
    fill(g, x0, 12 + 10 - u, x1 - x0, u, 'H');
    fill(g, x1 - u, 12, u, 10, 'H');
    for (let x = x0 + 2 * u; x < x1 - 2 * u; x += u) {
      if (hash2(Math.round(x / u), 3, 32) < 0.25) dot(g, x, 16, 'r');
      if (hash2(Math.round(x / u), 5, 32) < 0.2) dot(g, x, 18, 'r');
    }
  }
  fill(g, 72, 16, 12, u, 'i');
  fill(g, 72, 14, 12, u, 'o');
  fill(g, 4, 24, 92, u, 'p');
  // Feet.
  fill(g, 6, 26, 10, 4, 'p');
  fill(g, 84, 26, 10, 4, 'p');
  fill(g, 6, 26, u, 4, 'E');
  fill(g, 84, 26, u, 4, 'E');

  // Monitor: bezel lit on the top and left, a sheen across the top of the screen.
  fill(g, 2, -24, 36, 22, 'B');
  fill(g, 2, -24, 36, u, 'b');
  fill(g, 2, -24, u, 22, 'b');
  fill(g, SCREEN.x0, SCREEN.y0, SCREEN.x1 - SCREEN.x0, SCREEN.y1 - SCREEN.y0, 's');
  for (let x: number = SCREEN.x0; x < SCREEN.x1; x += u) {
    if (Math.round(x / u) % 2 === 0) dot(g, x, SCREEN.y0, 'S');
    if (Math.round(x / u) % 4 === 1) dot(g, x, SCREEN.y0 + u, 'S');
  }
  dot(g, 32, -4, 'n');
  fill(g, 16, -2, 8, 2, 'N');
  fill(g, 12, 0, 16, u, 'N');

  // Keyboard and mouse on the desk top.
  fill(g, 42, 0, 28, 4, 'k');
  for (let x = 44; x < 68; x += 2 * u) dot(g, x, 0, 'j');
  for (let x = 46; x < 66; x += 2 * u) dot(g, x, 2, 'j');
  fill(g, 42, 4, 28, u, 'J');
  fill(g, 74, 0, 6, 4, 'm');
  fill(g, 74, 4, 6, u, 'M');

  if (item === 'mug') {
    fill(g, 84, -10, 10, 10, 'u');
    fill(g, 84, -10, 10, u, 'c');
    fill(g, 92, -8, u, 8, 'U');
    fill(g, 94, -8, 4, 6, 'h');
    fill(g, 94, -6, u, 2, '.');
  } else if (item === 'plant') {
    const leaves: readonly [number, number, number][] = [
      [90, -13, 6],
      [84, -10, 4],
      [95, -10, 3],
    ];
    for (let y = -20; y < -5; y += u) {
      for (let x = 78; x < 99; x += u) {
        const cx = x + u / 2;
        const cy = y + u / 2;
        const inside = leaves.some(([lx, ly, r]) => (cx - lx) ** 2 + (cy - ly) ** 2 <= r * r);
        if (!inside) continue;
        const lit = cx - 90 + (cy + 13) < -3;
        const dark = cx - 90 + (cy + 13) > 4;
        dot(g, x, y, lit ? 'L' : dark ? 'e' : 'l');
      }
    }
    fill(g, 84, -6, 12, u, 'Q');
    fill(g, 86, -4, 8, 4, 'q');
  } else if (item === 'papers') {
    fill(g, 88, -8, 10, 4, 'w');
    fill(g, 82, -4, 14, 4, 'w');
    fill(g, 84, -2, 10, u, 'v');
    fill(g, 90, -6, 6, u, 'v');
    fill(g, 82, -2 + u, 14, u, 'V');
  }

  outline(g);
  // Floor shadow, dithered at the ends.
  under(g, 10, 30, 80, 4, 'x');
  for (const x of [6, 90]) dot(g, x, 30, 'x');
  return g.cells.map((r) => r.join(''));
}

/** Big pixels: the same desk, blocky. */
function composeCoarse(px: number, item: DeskItem): string[] {
  const g = makeGrid(px);

  // Desk body.
  fill(g, 10, 30, 80, 5, 'x');
  fill(g, 5, 25, 10, 5, 'K');
  fill(g, 85, 25, 10, 5, 'K');
  fill(g, 5, 10, 90, 15, 'K');
  fill(g, 10, 10, 80, 10, 'P');
  fill(g, 10, 20, 80, 5, 'p');
  fill(g, 60, 10, 5, 15, 'd');
  fill(g, 75, 15, 5, 5, 'o');
  fill(g, 0, 0, 100, 5, 'T');
  fill(g, 0, 5, 100, 5, 'E');
  fill(g, 0, 0, 5, 10, 'K');
  fill(g, 95, 0, 5, 10, 'K');

  // Monitor, keyboard and mouse.
  fill(g, 0, -25, 40, 25, 'B');
  fill(g, SCREEN.x0, SCREEN.y0, SCREEN.x1 - SCREEN.x0, SCREEN.y1 - SCREEN.y0, 's');
  fill(g, 10, 0, 20, 5, 'N');
  fill(g, 40, 0, 30, 5, 'k');
  fill(g, 75, 0, 5, 5, 'm');

  // Something on the far end of the desk.
  if (item === 'mug') {
    fill(g, 85, -10, 10, 10, 'u');
    fill(g, 95, -9, 4, 2 * px, 'h');
    fill(g, 97, -9, 2, 8, 'h');
    fill(g, 95, -3, 4, px, 'h');
  } else if (item === 'plant') {
    fill(g, 85, -15, 10, 5, 'l');
    fill(g, 90, -15, 5, 5, 'L');
    fill(g, 80, -10, 20, 5, 'l');
    fill(g, 85, -10, 5, 5, 'L');
    fill(g, 85, -5, 10, 5, 'q');
  } else if (item === 'papers') {
    fill(g, 90, -10, 10, 5, 'w');
    fill(g, 85, -5, 15, 5, 'w');
  }

  return g.cells.map((r) => r.join(''));
}

export function deskRuns(px: number, side: DeskSide, item: DeskItem): Run[] {
  const offset = toArt(-DESK_TOP_PX, px);
  return rowsToRuns(composeDesk(px, side, item)).map((r) => ({ ...r, y: r.y - offset }));
}

/* ---- screen content, in art cells with y relative to the desk-top line ---- */

function screenBox(px: number) {
  return {
    x0: toArt(SCREEN.x0, px),
    x1: toArt(SCREEN.x1, px),
    y0: toArt(SCREEN.y0, px),
    y1: toArt(SCREEN.y1, px),
  };
}

function mirror(cells: readonly Cell[], px: number, side: DeskSide): readonly Cell[] {
  if (side === 'left') return cells;
  const cols = toArt(DESK_WIDTH_PX, px);
  return cells.map(([x, y, k]): Cell => [cols - 1 - x, y, k]);
}

/** Two frames of "code" scrolling by, drawn in the agent's state color ('a'). */
export function codeFrames(px: number, side: DeskSide): readonly (readonly Cell[])[] {
  const s = screenBox(px);
  const step = px >= 4 ? 1 : 2;
  const width = s.x1 - s.x0;
  return [0, 1].map((frame) => {
    const cells: Cell[] = [];
    for (let y = s.y0 + (step - 1); y < s.y1; y += step) {
      const indent = Math.floor(hash2(y, frame, 1) * Math.max(1, width / 3));
      const length = 2 + Math.floor(hash2(y, frame, 2) * (width - indent - 2));
      for (let x = s.x0 + indent; x < Math.min(s.x1, s.x0 + indent + length); x++) {
        cells.push([x, y, 'a']);
      }
    }
    return mirror(cells, px, side);
  });
}

/** Needs-you: the screen flashes red with a "!", then shows just the "!". */
export function alertFrames(px: number, side: DeskSide): readonly (readonly Cell[])[] {
  const s = screenBox(px);
  const mid = Math.floor((s.x0 + s.x1) / 2) - 1;
  const bang: Cell[] = [];
  const barBottom = s.y1 - (px >= 4 ? 2 : 3);
  for (let y = s.y0; y < barBottom; y++) bang.push([mid, y, 'W'], [mid + 1, y, 'W']);
  for (let y = s.y1 - (px >= 4 ? 1 : 2); y < s.y1; y++) bang.push([mid, y, 'W'], [mid + 1, y, 'W']);
  const full: Cell[] = [];
  for (let y = s.y0; y < s.y1; y++) for (let x = s.x0; x < s.x1; x++) full.push([x, y, 'a']);
  return [
    mirror([...full, ...bang], px, side),
    mirror(
      bang.map(([x, y]): Cell => [x, y, 'a']),
      px,
      side,
    ),
  ];
}

/** Glare on a switched-off screen. */
export function screenGlare(px: number, side: DeskSide): readonly Cell[] {
  const s = screenBox(px);
  const cells: Cell[] = [
    [s.x0, s.y0, 'g'],
    [s.x0 + 1, s.y0, 'g'],
    [s.x0, s.y0 + 1, 'g'],
  ];
  if (px <= 3) cells.push([s.x0 + 2, s.y0, 'g'], [s.x0 + 1, s.y0 + 1, 'g'], [s.x0, s.y0 + 2, 'g']);
  return mirror(cells, px, side);
}
