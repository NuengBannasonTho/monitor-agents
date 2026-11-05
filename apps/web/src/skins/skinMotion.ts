/**
 * Turns one still skin image into a short looping animation, pixel by pixel:
 *
 * - Small parts that float free of the body (sparkles, shurikens, leaves, magic) bob
 *   up and down and twinkle.
 * - "fire" images: flame colors flicker in bands that climb upward, the flame outline
 *   licks in and out, and tiny embers rise.
 * - "cry" images: the tear streams shimmer downward and droplets fall.
 *
 * Fire and water are opt-in by image name: plenty of costumes have red capes or cyan
 * trim that must not start burning or flowing. Pure, so it runs in tests without a DOM.
 */

import { hash2 } from '../components/scene/pixels';

export type SkinEffect = 'fire' | 'water' | 'none';

/** Frames per loop. Every periodic motion below completes a whole number of cycles. */
export const SKIN_FRAMES = 8;
/** How long each frame shows. */
export const SKIN_FRAME_MS = 130;

const FIRE_NAMES = /fire|flame|burn|blaze|lava/;
const WATER_NAMES = /cry|tear|sad|sob|rain|water/;

export function skinEffectFor(imageName: string): SkinEffect {
  const name = imageName.toLowerCase();
  if (FIRE_NAMES.test(name)) return 'fire';
  if (WATER_NAMES.test(name)) return 'water';
  return 'none';
}

interface Hsv {
  readonly h: number;
  readonly s: number;
  readonly v: number;
}

function hsv(r: number, g: number, b: number): Hsv {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return { h: h < 0 ? h + 360 : h, s: max === 0 ? 0 : d / max, v: max / 255 };
}

function isFlame({ h, s, v }: Hsv): boolean {
  return (h <= 40 || h >= 345) && s >= 0.5 && v >= 0.55;
}

function isWater({ h, s, v }: Hsv): boolean {
  return h >= 170 && h <= 235 && s >= 0.3 && v >= 0.5;
}

/** Pulls a pixel toward `hot` (amount > 0) or `cold` (amount < 0). */
function tint(
  data: Uint8ClampedArray,
  i: number,
  amount: number,
  hot: readonly [number, number, number],
  cold: readonly [number, number, number],
): void {
  const target = amount >= 0 ? hot : cold;
  const t = Math.min(1, Math.abs(amount));
  for (let c = 0; c < 3; c++) {
    const v = data[i + c] ?? 0;
    data[i + c] = v + ((target[c] ?? v) - v) * t;
  }
}

const FLAME_HOT = [255, 240, 160] as const;
const FLAME_COLD = [130, 24, 10] as const;
const WATER_HOT = [235, 250, 255] as const;
const WATER_COLD = [28, 80, 160] as const;

/** Parts this small (in pixels) count as detached decorations rather than the character. */
function maxSatellite(opaqueCount: number): number {
  return Math.max(48, Math.round(opaqueCount * 0.03));
}

/** 8-connected groups of opaque pixels, largest first. */
function components(data: Uint8ClampedArray, size: number): number[][] {
  const opaque = (p: number): boolean => (data[p * 4 + 3] ?? 0) > 127;
  const seen = new Uint8Array(size * size);
  const groups: number[][] = [];
  for (let start = 0; start < size * size; start++) {
    if (seen[start] === 1 || !opaque(start)) continue;
    const group: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const p = stack.pop();
      if (p === undefined) break;
      group.push(p);
      const px = p % size;
      const py = Math.floor(p / size);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = px + dx;
          const y = py + dy;
          if (x < 0 || y < 0 || x >= size || y >= size) continue;
          const q = y * size + x;
          if (seen[q] === 0 && opaque(q)) {
            seen[q] = 1;
            stack.push(q);
          }
        }
      }
    }
    groups.push(group);
  }
  return groups.sort((a, b) => b.length - a.length);
}

/**
 * Builds `frames` RGBA frames (each size x size) from one RGBA image. Frame order loops
 * seamlessly. The body (largest part) never moves; only colors and detached parts do.
 */
export function buildSkinFrames(
  src: Uint8ClampedArray,
  size: number,
  effect: SkinEffect,
  frames = SKIN_FRAMES,
): Uint8ClampedArray[] {
  const groups = components(src, size);
  const opaqueCount = groups.reduce((n, g) => n + g.length, 0);
  const limit = maxSatellite(opaqueCount);
  const satellites = groups.slice(1).filter((g) => g.length <= limit);
  const inSatellite = new Uint8Array(size * size);
  for (const g of satellites) for (const p of g) inSatellite[p] = 1;

  const opaque = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < size && y < size && (src[(y * size + x) * 4 + 3] ?? 0) > 127;

  // Classify the body's pixels once.
  const flame = new Uint8Array(size * size);
  const water = new Uint8Array(size * size);
  if (effect !== 'none') {
    for (let p = 0; p < size * size; p++) {
      if (inSatellite[p] === 1 || (src[p * 4 + 3] ?? 0) <= 127) continue;
      const color = hsv(src[p * 4] ?? 0, src[p * 4 + 1] ?? 0, src[p * 4 + 2] ?? 0);
      if (effect === 'fire' && isFlame(color)) flame[p] = 1;
      if (effect === 'water' && isWater(color)) water[p] = 1;
    }
  }

  const out: Uint8ClampedArray[] = [];
  for (let f = 0; f < frames; f++) {
    const frame = new Uint8ClampedArray(src);
    const phase = (2 * Math.PI * f) / frames;

    // Lift the detached parts out; they are redrawn at their animated spot below.
    for (const g of satellites) for (const p of g) frame.fill(0, p * 4, p * 4 + 4);

    for (let p = 0; p < size * size; p++) {
      const x = p % size;
      const y = Math.floor(p / size);
      const i = p * 4;
      if (flame[p] === 1) {
        // Two bright bands per loop, climbing upward, with a little per-pixel jitter.
        const amount = 0.45 * Math.sin(y * 0.9 + 2 * phase + hash2(x, y, 1) * 1.8);
        tint(frame, i, amount, FLAME_HOT, FLAME_COLD);
        // Flame tips: grow a pixel into the empty space above, or flicker out.
        if (!opaque(x, y - 1)) {
          const r = hash2(x, y, 100 + f);
          if (r < 0.4) {
            const j = i - size * 4;
            frame[j] = frame[i] ?? 0;
            frame[j + 1] = frame[i + 1] ?? 0;
            frame[j + 2] = frame[i + 2] ?? 0;
            frame[j + 3] = 255;
            tint(frame, j, 0.5, FLAME_HOT, FLAME_COLD);
          } else if (r > 0.84 && flame[p + size] === 1) {
            frame.fill(0, i, i + 4);
          }
        }
      } else if (water[p] === 1) {
        // One shimmer per loop, flowing downward.
        const amount = 0.4 * Math.sin(y * 0.7 - phase + hash2(x, y, 2) * 0.8);
        tint(frame, i, amount, WATER_HOT, WATER_COLD);
      }
    }

    satellites.forEach((g, n) => {
      const offset = Math.floor(hash2(n, g.length, 3) * frames);
      const tiny = g.length <= 6;
      let dy: number;
      let alpha = 1;
      let sparkle = 0;
      if (tiny && effect !== 'none') {
        // Embers rise and fade; droplets fall and fade.
        const step = (f + offset) % frames;
        dy = (effect === 'fire' ? -1 : 1) * Math.floor(step / 2);
        alpha = 1 - step / frames;
      } else {
        dy = Math.round(Math.sin(phase + (2 * Math.PI * offset) / frames));
        if (effect === 'none' && (f + offset) % frames === 0) sparkle = 0.55;
      }
      for (const p of g) {
        const x = p % size;
        const y = Math.floor(p / size) + dy;
        if (y < 0 || y >= size) continue;
        const j = (y * size + x) * 4;
        // A fading ember over the body blends in instead of punching a hole in it.
        const keep = (frame[j + 3] ?? 0) === 255 ? 1 - alpha : 0;
        for (let c = 0; c < 3; c++) {
          frame[j + c] = (src[p * 4 + c] ?? 0) * (1 - keep) + (frame[j + c] ?? 0) * keep;
        }
        frame[j + 3] = keep > 0 ? 255 : (src[p * 4 + 3] ?? 0) * alpha;
        if (sparkle > 0) tint(frame, j, sparkle, [255, 255, 255], [0, 0, 0]);
      }
    });

    out.push(frame);
  }
  return out;
}
