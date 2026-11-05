import { describe, expect, it } from 'vitest';
import { SKIN_FRAMES, buildSkinFrames, skinEffectFor } from './skinMotion';

const SIZE = 16;

/** A 6x8 yellow body with a 1-pixel white sparkle floating to its right. */
function image(body: readonly [number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  const put = (x: number, y: number, [r, g, b]: readonly [number, number, number]) => {
    data.set([r, g, b, 255], (y * SIZE + x) * 4);
  };
  for (let y = 6; y < 14; y++) for (let x = 4; x < 10; x++) put(x, y, body);
  put(13, 5, [255, 255, 255]);
  put(13, 6, [255, 255, 255]);
  put(12, 6, [255, 255, 255]);
  put(14, 6, [255, 255, 255]);
  put(13, 7, [255, 255, 255]);
  put(13, 8, [255, 255, 255]);
  put(13, 9, [255, 255, 255]);
  return data;
}

const alphaAt = (frame: Uint8ClampedArray, x: number, y: number) =>
  frame[(y * SIZE + x) * 4 + 3] ?? 0;

describe('skinEffectFor', () => {
  it('only burns or flows for matching image names', () => {
    expect(skinEffectFor('fire')).toBe('fire');
    expect(skinEffectFor('Flame-2')).toBe('fire');
    expect(skinEffectFor('cry')).toBe('water');
    expect(skinEffectFor('king')).toBe('none');
    expect(skinEffectFor('ninja')).toBe('none');
  });
});

describe('buildSkinFrames', () => {
  it('returns a full loop of same-size frames', () => {
    const frames = buildSkinFrames(image([240, 200, 40]), SIZE, 'none');
    expect(frames).toHaveLength(SKIN_FRAMES);
    for (const f of frames) expect(f.length).toBe(SIZE * SIZE * 4);
  });

  it('keeps the body still and moves the detached sparkle', () => {
    const src = image([240, 200, 40]);
    const frames = buildSkinFrames(src, SIZE, 'none');
    for (const f of frames) {
      for (let y = 6; y < 14; y++) {
        for (let x = 4; x < 10; x++) {
          const i = (y * SIZE + x) * 4;
          expect([...f.slice(i, i + 4)]).toEqual([...src.slice(i, i + 4)]);
        }
      }
    }
    const tops = frames.map((f) => [4, 5, 6].find((y) => alphaAt(f, 13, y) > 0));
    expect(new Set(tops).size).toBeGreaterThan(1);
  });

  it('flickers flame colors only in fire images', () => {
    const red = image([230, 70, 20]);
    const burning = buildSkinFrames(red, SIZE, 'fire');
    const center = (7 * SIZE + 6) * 4;
    const reds = new Set(burning.map((f) => f[center + 1]));
    expect(reds.size).toBeGreaterThan(1);

    const cape = buildSkinFrames(red, SIZE, 'none');
    expect(new Set(cape.map((f) => f[center + 1])).size).toBe(1);
  });

  it('shimmers water colors in cry images', () => {
    const frames = buildSkinFrames(image([60, 170, 240]), SIZE, 'water');
    const center = (10 * SIZE + 6) * 4;
    expect(new Set(frames.map((f) => f[center])).size).toBeGreaterThan(1);
  });
});
