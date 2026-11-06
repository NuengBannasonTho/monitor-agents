import { unitFromString } from './seed';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/* ------------------------------------------------------------------ */
/* City desks                                                          */
/* ------------------------------------------------------------------ */

/**
 * Desk spacing in px. Desks are 100 px wide. Rows are far enough apart that the accessory
 * above a worker's head (terminal, "!") stays clear of the name tag in the row behind.
 */
export const DESK_PITCH_X = 112;
export const DESK_MIN_PITCH_X = 100;
export const DESK_PITCH_Y = 172;
const DESK_SIDE_MARGIN = 12;
/** First desk-top line below the plaza edge: room for the worker's head and the monitor. */
const FIRST_ROW_BELOW_HORIZON = 72;
/** Last desk-top line above the zone bottom: room for the desk front and the name tag. */
const LAST_ROW_ABOVE_BOTTOM = 62;

export interface DeskGrid {
  readonly cols: number;
  readonly rows: number;
  /** Desk-top centers in px relative to the zone, row-major. */
  readonly desks: readonly Point[];
  /** Desk indices in the order seats take them: the middle of the plaza first. */
  readonly fillOrder: readonly number[];
}

/**
 * Fills the plaza below `horizon` with as many desks as fit. If more seats are
 * `needed` than fit, desks squeeze closer (first sideways, then rows overlap)
 * so nobody is ever left without a desk.
 */
export function deskGrid(zone: Size, horizon: number, needed: number): DeskGrid {
  const usable = Math.max(0, zone.width - DESK_SIDE_MARGIN * 2);
  const yTop = horizon + FIRST_ROW_BELOW_HORIZON;
  const span = Math.max(0, zone.height - LAST_ROW_ABOVE_BOTTOM - yTop);
  const rowsFit = Math.floor(span / DESK_PITCH_Y) + 1;

  let cols = Math.max(1, Math.floor(usable / DESK_PITCH_X));
  let pitchX = DESK_PITCH_X;
  if (cols * rowsFit < needed) {
    const tighter = Math.max(cols, Math.floor(usable / DESK_MIN_PITCH_X));
    if (tighter > cols) {
      cols = tighter;
      pitchX = usable / cols;
    }
  }
  const rows = Math.max(rowsFit, Math.ceil(needed / cols));
  const pitchY = rows > rowsFit ? span / (rows - 1) : DESK_PITCH_Y;

  const x0 = zone.width / 2 - ((cols - 1) * pitchX) / 2;
  const y0 = yTop + (span - (rows - 1) * pitchY) / 2;
  const desks: Point[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) desks.push({ x: x0 + c * pitchX, y: y0 + r * pitchY });
  }

  const midCol = (cols - 1) / 2;
  const midRow = (rows - 1) / 2;
  const distance = (i: number): number => {
    const dc = (i % cols) - midCol;
    const dr = (Math.floor(i / cols) - midRow) * 1.15;
    return dc * dc + dr * dr;
  };
  const fillOrder = desks.map((_, i) => i).sort((a, b) => distance(a) - distance(b) || a - b);

  return { cols, rows, desks, fillOrder };
}

/* ------------------------------------------------------------------ */
/* Subagent desks                                                      */
/* ------------------------------------------------------------------ */

/** Two subagent desks share the place of one desk in a row. */
export const MINI_DESKS_PER_PLACE = 2;
/** How far each of the pair sits from the middle of the place. */
export const MINI_DESK_OFFSET_X = 28;

/** An agent and its subagents, seated together. */
export interface Team {
  readonly id: string;
  /** The place of the agent's own desk, or null when it is not at work (in Base Camp). */
  readonly home: number | null;
  readonly subagents: number;
}

export interface MiniSeat {
  /** The desk place it shares. */
  readonly place: number;
  /** Offset from the middle of that place, in px. */
  readonly dx: number;
}

/** Places a team's small desks take: one per pair of subagents. */
export function placesForSubagents(subagents: number): number {
  return Math.ceil(subagents / MINI_DESKS_PER_PLACE);
}

/**
 * Seats every team's subagents at small desks next to the agent's own desk, in the same row:
 * the free places to its right, then to its left, until something is in the way; anywhere
 * free and nearest after that. Agents keep their own desks; subagents never take one.
 * Returns, per team id, where each of its subagents sits (in order).
 */
export function seatSubagents(
  grid: DeskGrid,
  teams: readonly Team[],
): ReadonlyMap<string, readonly MiniSeat[]> {
  const taken = new Set<number>();
  for (const t of teams) if (t.home !== null) taken.add(t.home);
  const free = (place: number): boolean =>
    place >= 0 && place < grid.desks.length && !taken.has(place);
  const seats = new Map<string, MiniSeat[]>();

  for (const team of teams) {
    const need = placesForSubagents(team.subagents);
    if (need === 0) continue;
    const places: number[] = [];

    if (team.home !== null) {
      const row = Math.floor(team.home / grid.cols);
      const col = team.home % grid.cols;
      let right = true;
      let left = true;
      for (let d = 1; d < grid.cols && places.length < need && (right || left); d++) {
        for (const [dir, open] of [
          [1, right],
          [-1, left],
        ] as const) {
          if (!open || places.length >= need) continue;
          const c = col + dir * d;
          const place = row * grid.cols + c;
          if (c >= 0 && c < grid.cols && free(place)) places.push(place);
          else if (dir === 1) right = false;
          else left = false;
        }
      }
    }

    if (places.length < need) {
      // Nearest free places anywhere, or the middle of the plaza first without a home desk.
      const home = team.home;
      const distance = (p: number): number => {
        if (home === null) return grid.fillOrder.indexOf(p);
        const dc = (p % grid.cols) - (home % grid.cols);
        const dr = Math.floor(p / grid.cols) - Math.floor(home / grid.cols);
        return dc * dc + dr * dr * 4;
      };
      const rest = grid.fillOrder
        .filter((p) => free(p) && !places.includes(p))
        .sort((a, b) => distance(a) - distance(b));
      places.push(...rest.slice(0, need - places.length));
    }

    for (const p of places) taken.add(p);
    const list: MiniSeat[] = [];
    for (let i = 0; i < team.subagents; i++) {
      const place = places[Math.floor(i / MINI_DESKS_PER_PLACE)];
      if (place === undefined) break;
      const pairStart = i - (i % MINI_DESKS_PER_PLACE);
      const alone = team.subagents - pairStart === 1;
      list.push({
        place,
        dx: alone ? 0 : i % MINI_DESKS_PER_PLACE === 0 ? -MINI_DESK_OFFSET_X : MINI_DESK_OFFSET_X,
      });
    }
    seats.set(team.id, list);
  }
  return seats;
}

/* ------------------------------------------------------------------ */
/* Lounge                                                              */
/* ------------------------------------------------------------------ */

export interface LoungeGrid {
  readonly cols: number;
  readonly rows: number;
}

/** Grid dimensions that fit `slotCount` slots given the zone size and a minimum cell size. */
export function loungeGrid(zone: Size, slotCount: number, minCell: number): LoungeGrid {
  const cols = Math.max(1, Math.min(Math.floor(zone.width / minCell), Math.max(slotCount, 1)));
  const rows = Math.max(1, Math.ceil(slotCount / cols));
  return { cols, rows };
}

/**
 * Center of lounge slot `slot` in px relative to the zone, with a small
 * deterministic jitter per agent so the lounge does not look like a spreadsheet.
 * `padding` keeps characters (plus their bob amplitude) inside the zone bounds.
 */
export function loungeSlotPosition(
  zone: Size,
  grid: LoungeGrid,
  slot: number,
  padding: Point,
  jitterSeed: string,
): Point {
  const col = slot % grid.cols;
  const row = Math.floor(slot / grid.cols);
  const innerW = Math.max(0, zone.width - padding.x * 2);
  const innerH = Math.max(0, zone.height - padding.y * 2);
  const cellW = innerW / grid.cols;
  const cellH = innerH / grid.rows;
  const jitterX = (unitFromString(jitterSeed, 'jx') - 0.5) * Math.min(cellW * 0.3, 28);
  const jitterY = (unitFromString(jitterSeed, 'jy') - 0.5) * Math.min(cellH * 0.25, 18);
  // Offset odd rows half a cell for a staggered, more organic arrangement.
  const stagger = grid.cols > 1 && row % 2 === 1 ? cellW * 0.25 : 0;
  return {
    x: clamp(
      padding.x + cellW * (col + 0.5) + stagger + jitterX,
      padding.x,
      zone.width - padding.x,
    ),
    y: clamp(padding.y + cellH * (row + 0.5) + jitterY, padding.y, zone.height - padding.y),
  };
}

export function clamp(value: number, min: number, max: number): number {
  if (max < min) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}
