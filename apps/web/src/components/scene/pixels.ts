/**
 * Tiny software pixel buffer for the background scenes. Scenes are painted once per
 * size/theme/pixel-size change at "art" resolution and scaled up with nearest-neighbour
 * sampling, so every art pixel is the same size as a pixel of the avatars on screen.
 */

/** Packed 0xRRGGBBAA. */
export type Color = number;

export function parseColor(hex: string): Color {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex);
  if (m?.[1] === undefined) throw new Error(`invalid color: ${hex}`);
  const rgb = Number.parseInt(m[1], 16);
  const alpha = m[2] === undefined ? 255 : Number.parseInt(m[2], 16);
  return rgb * 256 + alpha;
}

export function withAlpha(color: Color, alpha: number): Color {
  const a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
  return Math.floor(color / 256) * 256 + a;
}

/** Opaque color `t` of the way from `a` to `b` (alpha taken from `a`). */
export function mix(a: Color, b: Color, t: number): Color {
  const ca = Math.floor(a / 256);
  const cb = Math.floor(b / 256);
  let rgb = 0;
  for (const shift of [16, 8, 0]) {
    const va = (ca >>> shift) & 255;
    const vb = (cb >>> shift) & 255;
    rgb += Math.round(va + (vb - va) * t) * 2 ** shift;
  }
  return rgb * 256 + (a % 256);
}

export type Palette<K extends string = string> = Readonly<Record<K, Color>>;

/** Parses a palette of hex strings once, so painting only deals with numbers. */
export function parsePalette<K extends string>(hexes: Readonly<Record<K, string>>): Palette<K> {
  const out = {} as Record<K, Color>;
  for (const key of Object.keys(hexes) as K[]) out[key] = parseColor(hexes[key]);
  return out;
}

export interface Sprite {
  readonly width: number;
  readonly height: number;
  /** [dx, dy, palette key] for every non-transparent cell. */
  readonly cells: readonly (readonly [number, number, string])[];
}

/** Rows of palette keys, '.' = transparent. All rows must be the same length. */
export function sprite(rows: readonly string[]): Sprite {
  const width = rows[0]?.length ?? 0;
  const cells: [number, number, string][] = [];
  rows.forEach((row, dy) => {
    if (row.length !== width) throw new Error(`sprite row ${dy} has length ${row.length}`);
    for (let dx = 0; dx < row.length; dx++) {
      const key = row.charAt(dx);
      if (key !== '.') cells.push([dx, dy, key]);
    }
  });
  return { width, height: rows.length, cells };
}

export class PixelBuffer {
  readonly data: Uint8ClampedArray<ArrayBuffer>;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  /** Paints one pixel; translucent colors blend over what is already there. */
  set(x: number, y: number, color: Color): void {
    const px = Math.floor(x);
    const py = Math.floor(y);
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return;
    const a = color % 256;
    if (a === 0) return;
    const i = (py * this.width + px) * 4;
    const rgb = Math.floor(color / 256);
    const r = (rgb >>> 16) & 255;
    const g = (rgb >>> 8) & 255;
    const b = rgb & 255;
    const d = this.data;
    if (a === 255) {
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
      return;
    }
    const t = a / 255;
    d[i] = (d[i] ?? 0) + (r - (d[i] ?? 0)) * t;
    d[i + 1] = (d[i + 1] ?? 0) + (g - (d[i + 1] ?? 0)) * t;
    d[i + 2] = (d[i + 2] ?? 0) + (b - (d[i + 2] ?? 0)) * t;
    d[i + 3] = Math.max(d[i + 3] ?? 0, a);
  }

  /** Packed color at a pixel (0 outside the buffer). */
  get(x: number, y: number): Color {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    const i = (y * this.width + x) * 4;
    const d = this.data;
    return (((d[i] ?? 0) * 256 + (d[i + 1] ?? 0)) * 256 + (d[i + 2] ?? 0)) * 256 + (d[i + 3] ?? 0);
  }

  rect(x: number, y: number, w: number, h: number, color: Color): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.floor(x + w));
    const y1 = Math.min(this.height, Math.floor(y + h));
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) this.set(px, py, color);
  }

  /** Draws a sprite with its top-left at (x, y); `flip` mirrors it horizontally. */
  sprite(s: Sprite, palette: Readonly<Record<string, Color>>, x: number, y: number, flip = false) {
    const ox = Math.round(x);
    const oy = Math.round(y);
    for (const [dx, dy, key] of s.cells) {
      const color = palette[key];
      if (color === undefined) continue;
      this.set(ox + (flip ? s.width - 1 - dx : dx), oy + dy, color);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Deterministic noise                                                 */
/* ------------------------------------------------------------------ */

/** Integer hash of a lattice point, in [0, 1). Same inputs, same value, on every resize. */
export function hash2(x: number, y: number, salt = 0): number {
  let h =
    Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1). */
export function valueNoise(x: number, y: number, salt = 0): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = lerp(hash2(x0, y0, salt), hash2(x0 + 1, y0, salt), sx);
  const bottom = lerp(hash2(x0, y0 + 1, salt), hash2(x0 + 1, y0 + 1, salt), sx);
  return lerp(top, bottom, sy);
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

/** 4x4 ordered-dither threshold in [0, 1): the classic pixel-art gradient pattern. */
export function bayer(x: number, y: number): number {
  return (BAYER4[(y & 3) * 4 + (x & 3)] ?? 0) / 16;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
