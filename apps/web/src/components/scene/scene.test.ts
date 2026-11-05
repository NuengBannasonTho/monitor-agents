import { describe, expect, it } from 'vitest';
import { cityHorizonPx, paintCity } from './city';
import { DESK_BOTTOM_PX, DESK_TOP_PX, DESK_WIDTH_PX, codeFrames, composeDesk } from './deskArt';
import { forestLandmarks, paintForest } from './forest';
import { PixelBuffer, parseColor, sprite, withAlpha } from './pixels';

/** Zone sizes in CSS px. */
const SIZES = [
  { width: 300, height: 460 },
  { width: 540, height: 800 },
  { width: 850, height: 850 },
];
/** Pixel workers (5 px) and image skins (2 px). */
const PIXELS = [5, 2];

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
  for (const px of PIXELS) {
    for (const theme of ['day', 'night'] as const) {
      for (const size of SIZES) {
        it(`paints every pixel of a ${size.width}x${size.height} ${theme} scene at ${px} px`, () => {
          const w = Math.ceil(size.width / px);
          const h = Math.ceil(size.height / px);
          const forest = new PixelBuffer(w, h);
          paintForest(forest, px, theme);
          expect(opaqueEverywhere(forest)).toBe(true);
          const city = new PixelBuffer(w, h);
          paintCity(city, px, theme);
          expect(opaqueEverywhere(city)).toBe(true);
        });
      }
    }
  }

  it('is deterministic', () => {
    const a = new PixelBuffer(200, 240);
    const b = new PixelBuffer(200, 240);
    paintForest(a, 2, 'day');
    paintForest(b, 2, 'day');
    expect(a.data).toEqual(b.data);
  });

  it('keeps the campfire inside the glade', () => {
    for (const { width, height } of SIZES) {
      const l = forestLandmarks(width, height);
      expect(l.camp.x).toBeGreaterThan(50);
      expect(l.camp.x).toBeLessThan(width - 50);
      expect(l.camp.y).toBeGreaterThan(l.treeLine);
      expect(l.camp.y).toBeLessThan(height);
    }
  });

  it('puts the plaza at the same place at any pixel size', () => {
    expect(cityHorizonPx(460, 5)).toBe(120);
    expect(cityHorizonPx(460, 2)).toBe(120);
    expect(cityHorizonPx(2000, 2)).toBe(170);
    expect(cityHorizonPx(300, 5)).toBe(110);
  });
});

describe('desk art', () => {
  for (const px of PIXELS) {
    it(`is a full grid at ${px} px`, () => {
      const rows = composeDesk(px, 'left', 'mug');
      expect(rows).toHaveLength(Math.round((DESK_BOTTOM_PX - DESK_TOP_PX) / px));
      for (const r of rows) expect(r).toHaveLength(Math.round(DESK_WIDTH_PX / px));
    });

    it(`mirrors the right-hand variant at ${px} px`, () => {
      const left = composeDesk(px, 'left', 'plant');
      const right = composeDesk(px, 'right', 'plant');
      left.forEach((row, i) => {
        const mirrored = Array.from({ length: row.length }, (_, x) =>
          row.charAt(row.length - 1 - x),
        ).join('');
        expect(right[i]).toBe(mirrored);
      });
    });

    it(`keeps code on the screen at ${px} px`, () => {
      const rows = composeDesk(px, 'left', 'none');
      const top = Math.round(-DESK_TOP_PX / px);
      for (const frame of codeFrames(px, 'left')) {
        expect(frame.length).toBeGreaterThan(0);
        // 's' is the screen, 'S' its sheen.
        for (const [x, y] of frame) expect('sS').toContain(rows[y + top]?.charAt(x));
      }
    });
  }

  it('shows more detail with small pixels', () => {
    const coarse = new Set(composeDesk(5, 'left', 'mug').join(''));
    const fine = new Set(composeDesk(2, 'left', 'mug').join(''));
    expect(fine.has('j')).toBe(true);
    expect(coarse.has('j')).toBe(false);
  });

  it('outlines the fine desk and monitor', () => {
    const rows = composeDesk(2, 'left', 'plant');
    const keys = new Set(rows.join(''));
    for (const k of ['K', 'O', 'Z']) expect(keys.has(k)).toBe(true);
    // Every row is the full desk width.
    for (const row of rows) expect(row).toHaveLength(50);
  });
});
