import { describe, expect, it } from 'vitest';
import { cityHorizonArt, paintCity } from './city';
import { DESK_COLS, DESK_ROWS, DESK_ROWS_ABOVE, composeDesk } from './deskSprite';
import { forestLandmarks, paintForest } from './forest';
import { PixelBuffer, parseColor, sprite, withAlpha } from './pixels';

const SIZES = [
  { width: 60, height: 92 },
  { width: 108, height: 160 },
  { width: 170, height: 170 },
];

function opaqueEverywhere(buf: PixelBuffer): boolean {
  for (let i = 3; i < buf.data.length; i += 4) if (buf.data[i] !== 255) return false;
  return true;
}

describe('pixel buffer', () => {
  it('parses and re-alphas colors', () => {
    expect(parseColor('#ff8000')).toBe(0xff8000ff);
    expect(parseColor('#00000080') % 256).toBe(0x80);
    expect(withAlpha(parseColor('#123456'), 0) % 256).toBe(0);
  });

  it('blends translucent pixels over opaque ones', () => {
    const buf = new PixelBuffer(1, 1);
    buf.set(0, 0, parseColor('#000000'));
    buf.set(0, 0, parseColor('#ffffff80'));
    expect(buf.data[0]).toBeGreaterThan(120);
    expect(buf.data[0]).toBeLessThan(135);
    expect(buf.data[3]).toBe(255);
  });

  it('rejects ragged sprites', () => {
    expect(() => sprite(['ab', 'abc'])).toThrow();
  });
});

describe('scenes', () => {
  for (const theme of ['day', 'night'] as const) {
    for (const size of SIZES) {
      it(`paints every pixel of a ${size.width}x${size.height} ${theme} forest and city`, () => {
        const forest = new PixelBuffer(size.width, size.height);
        paintForest(forest, theme);
        expect(opaqueEverywhere(forest)).toBe(true);
        const city = new PixelBuffer(size.width, size.height);
        paintCity(city, theme);
        expect(opaqueEverywhere(city)).toBe(true);
      });
    }
  }

  it('is deterministic', () => {
    const a = new PixelBuffer(100, 120);
    const b = new PixelBuffer(100, 120);
    paintForest(a, 'day');
    paintForest(b, 'day');
    expect(a.data).toEqual(b.data);
  });

  it('keeps the campfire inside the glade', () => {
    for (const { width, height } of SIZES) {
      const l = forestLandmarks(width, height);
      expect(l.camp.x).toBeGreaterThan(10);
      expect(l.camp.x).toBeLessThan(width - 10);
      expect(l.camp.y).toBeGreaterThan(l.treeLine);
      expect(l.camp.y).toBeLessThan(height);
    }
  });

  it('leaves the plaza most of the city zone', () => {
    expect(cityHorizonArt(92)).toBe(24);
    expect(cityHorizonArt(400)).toBe(34);
  });
});

describe('desk sprite', () => {
  it('is a full 20 x 12 grid', () => {
    const rows = composeDesk('left', 'mug');
    expect(rows).toHaveLength(DESK_ROWS);
    for (const r of rows) expect(r).toHaveLength(DESK_COLS);
  });

  it('mirrors the right-hand variant', () => {
    const left = composeDesk('left', 'plant');
    const right = composeDesk('right', 'plant');
    left.forEach((row, i) => {
      expect(right[i]).toBe(
        Array.from({ length: row.length }, (_, x) => row.charAt(row.length - 1 - x)).join(''),
      );
    });
  });

  it('keeps the monitor screen clear for the animated content', () => {
    const rows = composeDesk('left', 'none');
    for (let y = -4; y <= -2; y++) {
      expect(rows[y + DESK_ROWS_ABOVE]?.slice(1, 7)).toBe('ssssss');
    }
  });
});
