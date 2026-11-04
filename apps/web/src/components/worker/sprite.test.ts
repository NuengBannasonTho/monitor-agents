import { AGENT_STATES } from '@agent-office/shared';
import { describe, expect, it } from 'vitest';
import { workerPalette } from './palette';
import {
  ACCESSORY_ROWS,
  ALERT,
  BODY,
  DOCUMENT,
  SPRITE_COLS,
  SPRITE_ROWS,
  TERMINAL,
  ZZZ,
  faceFor,
  rowsToRuns,
} from './sprite';

const palette = workerPalette(352, 'test');

describe('sprite', () => {
  it('body grid is SPRITE_COLS x SPRITE_ROWS', () => {
    expect(BODY).toHaveLength(SPRITE_ROWS);
    for (const row of BODY) expect(row).toHaveLength(SPRITE_COLS);
  });

  it('every body key has a color', () => {
    for (const run of rowsToRuns(BODY)) expect(palette[run.key], run.key).toBeDefined();
  });

  it('is horizontally symmetric apart from the lanyard knot and highlights', () => {
    const mirrorable = BODY.filter((_, y) => y !== 2 && y !== 3 && y !== 5 && y !== 13);
    const reverse = (row: string): string => {
      let out = '';
      for (let i = row.length - 1; i >= 0; i--) out += row.charAt(i);
      return out;
    };
    for (const row of mirrorable) {
      const masked = row.replace(/[hYB]/g, 'x');
      expect(masked).toBe(reverse(masked));
    }
  });

  it.each(AGENT_STATES)('%s face stays on the face and uses known colors', (state) => {
    for (const blinking of [false, true]) {
      const face = faceFor(state, blinking);
      for (const [x, y, key] of [...face.cells, ...(face.drifting ?? [])]) {
        expect(x).toBeGreaterThanOrEqual(2);
        expect(x).toBeLessThanOrEqual(15);
        expect(y).toBeGreaterThanOrEqual(5);
        expect(y).toBeLessThanOrEqual(11);
        expect(palette[key], key).toBeDefined();
      }
    }
  });

  it('accessories fit inside the headroom or the body grid', () => {
    for (const [x, y, key] of [...TERMINAL, ...ALERT, ...ZZZ]) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(SPRITE_COLS);
      expect(y).toBeGreaterThanOrEqual(-ACCESSORY_ROWS);
      expect(y).toBeLessThan(0);
      expect(palette[key], key).toBeDefined();
    }
    for (const [, y] of DOCUMENT) expect(y).toBeLessThan(SPRITE_ROWS);
  });

  it('run-length merges consecutive cells', () => {
    expect(rowsToRuns(['..KKK.S'])).toEqual([
      { x: 2, y: 0, w: 3, key: 'K' },
      { x: 6, y: 0, w: 1, key: 'S' },
    ]);
  });
});
