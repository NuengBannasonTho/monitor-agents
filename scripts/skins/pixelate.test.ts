import { describe, expect, it } from 'vitest';
import {
  cropWithPadding,
  opaqueBounds,
  removeBackground,
  squareAround,
  thresholdAlpha,
  unionBox,
} from './pixelate.js';

/** 6x6 grey image with a black-outlined 2x2 white square in the middle. */
function sample(): Uint8Array {
  const w = 6;
  const px = new Uint8Array(w * w * 4);
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inner = x >= 2 && x <= 3 && y >= 2 && y <= 3;
      const ring = x >= 1 && x <= 4 && y >= 1 && y <= 4 && !inner;
      const v = inner ? 236 : ring ? 10 : 236; // inner is background-colored on purpose
      px.set([v, v, v, 255], i);
    }
  }
  return px;
}

describe('pixelate', () => {
  it('removes only background connected to the border', () => {
    const px = removeBackground(sample(), 6, 6);
    expect(px[3]).toBe(0); // corner gone
    expect(px[(1 * 6 + 1) * 4 + 3]).toBe(255); // outline kept
    expect(px[(2 * 6 + 2) * 4 + 3]).toBe(255); // enclosed light pixel kept
  });

  it('finds the opaque bounds', () => {
    const px = removeBackground(sample(), 6, 6);
    expect(opaqueBounds(px, 6, 6)).toEqual({ left: 1, top: 1, right: 5, bottom: 5 });
    expect(opaqueBounds(new Uint8Array(16), 2, 2)).toBeNull();
  });

  it('unions boxes and builds a bottom-aligned square', () => {
    const u = unionBox([
      { left: 10, top: 20, right: 30, bottom: 100 },
      { left: 0, top: 40, right: 50, bottom: 90 },
    ]);
    expect(u).toEqual({ left: 0, top: 20, right: 50, bottom: 100 });
    if (u === null) return;
    const sq = squareAround(u, 0);
    expect(sq.right - sq.left).toBe(sq.bottom - sq.top);
    expect(sq.bottom).toBe(100);
    expect((sq.left + sq.right) / 2).toBe(25);
  });

  it('snaps alpha to 0 or 255', () => {
    const px = thresholdAlpha(new Uint8Array([0, 0, 0, 50, 0, 0, 0, 200]));
    expect([px[3], px[7]]).toEqual([0, 255]);
  });
});

describe('cropWithPadding', () => {
  // 2x2 image: pixel value = index + 1 in every channel.
  const img = new Uint8Array([1, 1, 1, 255, 2, 2, 2, 255, 3, 3, 3, 255, 4, 4, 4, 255]);

  it('returns exactly the requested size, padding outside the image', () => {
    const out = cropWithPadding(img, 2, 2, { left: -1, top: 0, right: 2, bottom: 3 });
    expect(out.length).toBe(3 * 3 * 4);
    const px = (x: number, y: number): number => out[(y * 3 + x) * 4] ?? -1;
    const alpha = (x: number, y: number): number => out[(y * 3 + x) * 4 + 3] ?? -1;
    expect([px(1, 0), px(2, 0), px(1, 1), px(2, 1)]).toEqual([1, 2, 3, 4]);
    expect(alpha(0, 0)).toBe(0); // padded column
    expect(alpha(1, 2)).toBe(0); // padded row
  });

  it('crops inside the image', () => {
    expect([...cropWithPadding(img, 2, 2, { left: 1, top: 1, right: 2, bottom: 2 })]).toEqual([
      4, 4, 4, 255,
    ]);
  });
});
