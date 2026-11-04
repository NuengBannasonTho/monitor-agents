import type { AgentState } from '@agent-office/shared';

/**
 * Original pixel-art office worker. 18 x 22 cells, plus ACCESSORY_ROWS of headroom
 * above the head for state accessories (terminal, alert bubble, zzz).
 *
 * Palette keys:
 *   K outline · H hair · h hair highlight · S skin · s skin shadow
 *   C shirt · c shirt shadow · L shirt light · Y lanyard · B badge
 *   P trousers · F shoes · . transparent
 */
export const SPRITE_COLS = 18;
export const SPRITE_ROWS = 22;
export const ACCESSORY_ROWS = 6;

export const BODY: readonly string[] = [
  '.....KKKKKKKK.....',
  '...KKHHHHHHHHKK...',
  '..KHHhhHHHHHHHHK..',
  '.KHHhHHHHHHHHHHHK.',
  '.KHHHHHHHHHHHHHHK.',
  '.KHHSSSHHSSSSHHHK.',
  '.KHSSSSSSSSSSSSHK.',
  '.KHSSSSSSSSSSSSHK.',
  '.KSSSSSSSSSSSSSSK.',
  '.KSSSSSSSSSSSSSSK.',
  '..KSSSSSSSSSSSSK..',
  '...KKsSSSSSSsKK...',
  '.....KCSSSSCK.....',
  '..KKCCYCCCCYCCKK..',
  '.KCCKCCYCCYCCKCCK.',
  '.KCCKCCCYYCCCKCCK.',
  '.KcCKCCBBBBCCKCcK.',
  '.KSSKCCBBBBCCKSSK.',
  '..KKKccccccccKKK..',
  '....KPPPPPPPPK....',
  '....KPPPKKPPPK....',
  '...KFFFFKKFFFFK...',
];

/** A single cell: [col, row, palette key]. Rows may be negative (accessory headroom). */
export type Cell = readonly [number, number, string];

/** Face keys: E eye · W eye white · M mouth · m mouth inside · R blush · b brow · D sweat. */
const L_EYE = 5;
const R_EYE = 11;
const EYE_ROW = 7;

function eyes2x2(withHighlight: boolean): Cell[] {
  const cells: Cell[] = [];
  for (const x of [L_EYE, R_EYE]) {
    cells.push([x, EYE_ROW, 'E'], [x + 1, EYE_ROW, withHighlight ? 'W' : 'E']);
    cells.push([x, EYE_ROW + 1, 'E'], [x + 1, EYE_ROW + 1, 'E']);
  }
  return cells;
}

/** Closed / squinting eyes: a 2-wide line on the lower eye row. */
function eyeLines(): Cell[] {
  return [L_EYE, R_EYE].flatMap((x): Cell[] => [
    [x, EYE_ROW + 1, 'E'],
    [x + 1, EYE_ROW + 1, 'E'],
  ]);
}

const SMALL_MOUTH: Cell[] = [
  [8, 10, 'M'],
  [9, 10, 'M'],
];

const SMILE: Cell[] = [
  [7, 9, 'M'],
  [8, 10, 'M'],
  [9, 10, 'M'],
  [10, 9, 'M'],
];

export interface Face {
  /** Cells drawn over the body. */
  readonly cells: readonly Cell[];
  /** Cells that drift left/right (reading pupils). */
  readonly drifting?: readonly Cell[];
}

export function faceFor(state: AgentState, blinking: boolean): Face {
  switch (state) {
    case 'idle':
      return { cells: [...(blinking ? eyeLines() : eyes2x2(true)), ...SMALL_MOUTH] };
    case 'called':
      return {
        cells: [
          ...(blinking ? eyeLines() : eyes2x2(true)),
          [5, 5, 'b'],
          [6, 5, 'b'],
          [11, 5, 'b'],
          [12, 5, 'b'],
          [8, 10, 'm'],
          [9, 10, 'm'],
        ],
      };
    case 'working':
      // Focused: squint + brows angled down toward the center + a bead of sweat.
      return {
        cells: [
          ...eyeLines(),
          [4, 6, 'b'],
          [5, 6, 'b'],
          [6, 7, 'b'],
          [13, 6, 'b'],
          [12, 6, 'b'],
          [11, 7, 'b'],
          [8, 10, 'M'],
          [9, 10, 'M'],
          [14, 6, 'D'],
          [14, 7, 'D'],
        ],
      };
    case 'reading':
      return {
        cells: [
          [L_EYE, EYE_ROW, 'W'],
          [L_EYE + 1, EYE_ROW, 'W'],
          [L_EYE, EYE_ROW + 1, 'W'],
          [L_EYE + 1, EYE_ROW + 1, 'W'],
          [R_EYE, EYE_ROW, 'W'],
          [R_EYE + 1, EYE_ROW, 'W'],
          [R_EYE, EYE_ROW + 1, 'W'],
          [R_EYE + 1, EYE_ROW + 1, 'W'],
          [8, 10, 'M'],
        ],
        drifting: [
          [L_EYE, EYE_ROW + 1, 'E'],
          [R_EYE, EYE_ROW + 1, 'E'],
        ],
      };
    case 'running':
      return { cells: [...(blinking ? eyeLines() : eyes2x2(true)), ...SMILE] };
    case 'needs-you':
      // Worried: inner brow ends raised, wide shiny eyes, open mouth, sweat.
      return {
        cells: [
          ...eyes2x2(true),
          [L_EYE, EYE_ROW + 2, 'E'],
          [L_EYE + 1, EYE_ROW + 2, 'E'],
          [R_EYE, EYE_ROW + 2, 'E'],
          [R_EYE + 1, EYE_ROW + 2, 'E'],
          [4, 6, 'b'],
          [5, 6, 'b'],
          [6, 5, 'b'],
          [13, 6, 'b'],
          [12, 6, 'b'],
          [11, 5, 'b'],
          [8, 10, 'M'],
          [9, 10, 'M'],
          [8, 11, 'm'],
          [9, 11, 'm'],
          [14, 7, 'D'],
          [14, 8, 'D'],
        ],
      };
    case 'done':
      // Happy ^ ^ eyes, wide grin, blush.
      return {
        cells: [
          [4, 8, 'E'],
          [5, 7, 'E'],
          [6, 7, 'E'],
          [7, 8, 'E'],
          [10, 8, 'E'],
          [11, 7, 'E'],
          [12, 7, 'E'],
          [13, 8, 'E'],
          [7, 10, 'M'],
          [8, 10, 'm'],
          [9, 10, 'm'],
          [10, 10, 'M'],
          [8, 11, 'M'],
          [9, 11, 'M'],
          [3, 9, 'R'],
          [4, 9, 'R'],
          [13, 9, 'R'],
          [14, 9, 'R'],
        ],
      };
    case 'stale':
      return { cells: [...eyeLines(), [8, 10, 'M']] };
  }
}

/* ---- accessories (drawn in the headroom rows, y < 0) ---- */

function fromRows(rows: readonly string[], x0: number, y0: number): Cell[] {
  const cells: Cell[] = [];
  rows.forEach((row, dy) => {
    // Sprite rows are ASCII palette keys, so indexing by UTF-16 unit is exact.
    for (let dx = 0; dx < row.length; dx++) {
      const key = row.charAt(dx);
      if (key !== '.') cells.push([x0 + dx, y0 + dy, key]);
    }
  });
  return cells;
}

/** Terminal window above the head. 'd' screen, 'G' green prompt. */
export const TERMINAL = fromRows(
  ['KKKKKKKK', 'KdGddddK', 'KddGdddK', 'KdGddddK', 'KKKKKKKK'],
  5,
  -6,
);
/** Blinking cursor inside the terminal. */
export const TERMINAL_CURSOR: readonly Cell[] = [
  [9, -3, 'G'],
  [10, -3, 'G'],
];

/** Red alert bubble with "!". 'r' red, 'W' white. */
export const ALERT = fromRows(['.KKK.', 'KrWrK', 'KrWrK', 'KrrrK', 'KrWrK', '.KKK.'], 13, -6);

/** Two small "z" for sleepy agents. 'z' muted ink. */
export const ZZZ = fromRows(['...zzz', '....z.', '...zzz', 'zz....', '.z....', 'zz....'], 12, -6);

/** Document held in front of the chest while reading. 'W' paper, 'g' text lines. */
export const DOCUMENT = fromRows(
  ['KKKKKKKK', 'KWWWWWWK', 'KWggggWK', 'KWWWWWWK', 'KWgggWWK', 'KWWWWWWK', 'KKKKKKKK'],
  5,
  13,
);

/** Run-length merge so each row becomes a few <rect>s instead of one per cell. */
export interface Run {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly key: string;
}

export function rowsToRuns(rows: readonly string[]): Run[] {
  const runs: Run[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const key = row.charAt(x);
      let w = 1;
      while (x + w < row.length && row.charAt(x + w) === key) w++;
      if (key !== '.') runs.push({ x, y, w, key });
      x += w;
    }
  });
  return runs;
}

/* ---- badges for image skins, which cannot show these states on their own ---- */

/** Small document: reading. */
export const DOC_BADGE = fromRows(['KKKKK', 'KWWWK', 'KgggK', 'KWWWK', 'KggWK', 'KKKKK'], 7, -6);

/** Speech bubble with dots: working. */
export const TYPING_BADGE = fromRows(
  ['.KKKKKKK.', 'KWWWWWWWK', 'KWEWEWEWK', 'KWWWWWWWK', '.KKKKKKK.'],
  5,
  -6,
);
