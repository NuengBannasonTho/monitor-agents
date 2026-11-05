/**
 * Shape helpers that take sizes in CSS px and rasterize them at any pixel size, so a scene
 * can match whichever avatar is on screen (5 px cells for pixel workers, 2 px for image
 * skins) without redrawing its art. Every shape is sampled at art-pixel centers.
 */
import type { Color, PixelBuffer } from './pixels';
import { bayer, hash2, valueNoise } from './pixels';

export interface Disc {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/** Five tones from the outline to the highlight. */
export interface Tones {
  readonly edge: Color;
  readonly dark: Color;
  readonly mid: Color;
  readonly light: Color;
  readonly hi: Color;
}

/** Art-pixel index of a CSS coordinate. */
export function toArt(css: number, px: number): number {
  return Math.round(css / px);
}

/** Center of an art pixel, in CSS px. */
function center(i: number, px: number): number {
  return (i + 0.5) * px;
}

/** Axis-aligned rectangle in CSS px; edges snap to the pixel grid. Never thinner than 1 pixel. */
export function rectCss(
  buf: PixelBuffer,
  px: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: Color,
): void {
  const x0 = toArt(x, px);
  const y0 = toArt(y, px);
  const x1 = Math.max(x0 + 1, toArt(x + w, px));
  const y1 = Math.max(y0 + 1, toArt(y + h, px));
  buf.rect(x0, y0, x1 - x0, y1 - y0, color);
}

/**
 * Calls `fn` for every art pixel of the same rectangle `rectCss` would fill, with its
 * position inside the rectangle in art pixels (i, j) and the rectangle's size (cols, rows).
 * Returning a color paints that pixel; returning undefined leaves it.
 */
export function rectEach(
  buf: PixelBuffer,
  px: number,
  x: number,
  y: number,
  w: number,
  h: number,
  fn: (
    i: number,
    j: number,
    cols: number,
    rows: number,
    ax: number,
    ay: number,
  ) => Color | undefined,
): void {
  const x0 = toArt(x, px);
  const y0 = toArt(y, px);
  const cols = Math.max(1, toArt(x + w, px) - x0);
  const rows = Math.max(1, toArt(y + h, px) - y0);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const color = fn(i, j, cols, rows, x0 + i, y0 + j);
      if (color !== undefined) buf.set(x0 + i, y0 + j, color);
    }
  }
}

export function ellipseCss(
  buf: PixelBuffer,
  px: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: Color,
): void {
  const x0 = Math.floor((cx - rx) / px);
  const x1 = Math.ceil((cx + rx) / px);
  const y0 = Math.floor((cy - ry) / px);
  const y1 = Math.ceil((cy + ry) / px);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (center(x, px) - cx) / rx;
      const dy = (center(y, px) - cy) / ry;
      if (dx * dx + dy * dy <= 1) buf.set(x, y, color);
    }
  }
}

interface MaskBox {
  readonly x0: number;
  readonly y0: number;
  readonly w: number;
  readonly h: number;
  readonly inside: Uint8Array;
}

function mask(
  px: number,
  bounds: { left: number; top: number; right: number; bottom: number },
  test: (x: number, y: number) => boolean,
): MaskBox {
  const x0 = Math.floor(bounds.left / px) - 1;
  const y0 = Math.floor(bounds.top / px) - 1;
  const w = Math.ceil(bounds.right / px) + 2 - x0;
  const h = Math.ceil(bounds.bottom / px) + 2 - y0;
  const inside = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (test(center(x0 + i, px), center(y0 + j, px))) inside[j * w + i] = 1;
    }
  }
  return { x0, y0, w, h, inside };
}

function isEdge(m: MaskBox, i: number, j: number): boolean {
  const at = (a: number, b: number): boolean =>
    a >= 0 && b >= 0 && a < m.w && b < m.h && m.inside[b * m.w + a] === 1;
  return !(at(i - 1, j) && at(i + 1, j) && at(i, j - 1) && at(i, j + 1));
}

function tone(t: Tones, shade: number): Color {
  if (shade > 0.58) return t.hi;
  if (shade > 0.3) return t.light;
  if (shade > -0.05) return t.mid;
  return t.dark;
}

/**
 * A lumpy rounded shape (tree canopy, bush, rock, cloud) made of overlapping discs, lit from
 * the top left, with a one-pixel outline and dithered tone steps. `texture` adds leafy
 * noise; `flatBottom` clips everything below that line.
 */
export function blob(
  buf: PixelBuffer,
  px: number,
  discs: readonly Disc[],
  tones: Tones,
  opts: { salt?: number; texture?: number; flatBottom?: number; outline?: boolean } = {},
): void {
  const { salt = 0, texture = 0, flatBottom = Infinity, outline = true } = opts;
  const bounds = {
    left: Math.min(...discs.map((d) => d.x - d.r)),
    top: Math.min(...discs.map((d) => d.y - d.r)),
    right: Math.max(...discs.map((d) => d.x + d.r)),
    bottom: Math.min(flatBottom, Math.max(...discs.map((d) => d.y + d.r))),
  };
  const m = mask(px, bounds, (x, y) => {
    if (y > flatBottom) return false;
    return discs.some((d) => (x - d.x) ** 2 + (y - d.y) ** 2 <= d.r * d.r);
  });
  for (let j = 0; j < m.h; j++) {
    for (let i = 0; i < m.w; i++) {
      if (m.inside[j * m.w + i] !== 1) continue;
      const ax = m.x0 + i;
      const ay = m.y0 + j;
      if (outline && isEdge(m, i, j)) {
        buf.set(ax, ay, tones.edge);
        continue;
      }
      const x = center(ax, px);
      const y = center(ay, px);
      // Light from the disc this pixel sits deepest in.
      let best = -Infinity;
      let nx = 0;
      let ny = 0;
      for (const d of discs) {
        const dist = Math.hypot(x - d.x, y - d.y) / d.r;
        if (1 - dist > best) {
          best = 1 - dist;
          nx = (x - d.x) / d.r;
          ny = (y - d.y) / d.r;
        }
      }
      let shade = -(nx * 0.62 + ny * 0.78) * 0.62 + best * 0.32 - 0.05;
      if (texture > 0) shade += (valueNoise(x / 7, y / 7, salt) - 0.5) * texture;
      shade += (bayer(ax, ay) - 0.5) * 0.2;
      buf.set(ax, ay, tone(tones, shade));
    }
  }
}

/** A stacked-tier conifer standing on (cx, baseY). */
export function pine(
  buf: PixelBuffer,
  px: number,
  cx: number,
  baseY: number,
  height: number,
  width: number,
  tones: Tones,
  trunk: { light: Color; dark: Color },
): void {
  const trunkH = height * 0.16;
  const trunkW = Math.max(px, width * 0.2);
  rectCss(buf, px, cx - trunkW / 2, baseY - trunkH, trunkW / 2, trunkH, trunk.light);
  rectCss(buf, px, cx, baseY - trunkH, trunkW / 2, trunkH, trunk.dark);

  const top = baseY - height;
  const canopy = height - trunkH * 0.6;
  const tiers = 4;
  const halfAt = (x: number, y: number): number => {
    // Widest of the tiers covering this row, or -1.
    let half = -1;
    for (let t = 0; t < tiers; t++) {
      const apex = top + t * canopy * 0.22;
      const bottom = apex + canopy * 0.4;
      if (y < apex || y > bottom) continue;
      const k = (y - apex) / (bottom - apex);
      const tierHalf = (width / 2) * (0.42 + (0.58 * (t + 1)) / tiers);
      // Ragged lower edge of each tier.
      const jag = k > 0.86 && Math.floor((x - cx) / (px * 2)) % 2 === 0 ? 0.88 : 1;
      half = Math.max(half, tierHalf * k * jag);
    }
    return half;
  };
  const m = mask(
    px,
    { left: cx - width / 2, top, right: cx + width / 2, bottom: top + canopy },
    (x, y) => Math.abs(x - cx) <= halfAt(x, y),
  );
  for (let j = 0; j < m.h; j++) {
    for (let i = 0; i < m.w; i++) {
      if (m.inside[j * m.w + i] !== 1) continue;
      const ax = m.x0 + i;
      const ay = m.y0 + j;
      if (isEdge(m, i, j)) {
        buf.set(ax, ay, tones.edge);
        continue;
      }
      const x = center(ax, px);
      const y = center(ay, px);
      const half = Math.max(1, halfAt(x, y));
      const shade =
        -((x - cx) / half) * 0.55 +
        0.12 -
        ((y - top) / canopy) * 0.25 +
        (hash2(ax, ay, 9) < 0.08 ? -0.3 : 0) +
        (bayer(ax, ay) - 0.5) * 0.25;
      buf.set(ax, ay, tone(tones, shade));
    }
  }
}

/** Every art pixel whose center lies in the CSS box, with its CSS center. */
export function eachPixel(
  buf: PixelBuffer,
  px: number,
  box: { left: number; top: number; right: number; bottom: number },
  fn: (ax: number, ay: number, x: number, y: number) => void,
): void {
  const x0 = Math.max(0, Math.floor(box.left / px));
  const y0 = Math.max(0, Math.floor(box.top / px));
  const x1 = Math.min(buf.width - 1, Math.ceil(box.right / px));
  const y1 = Math.min(buf.height - 1, Math.ceil(box.bottom / px));
  for (let ay = y0; ay <= y1; ay++) {
    for (let ax = x0; ax <= x1; ax++) fn(ax, ay, center(ax, px), center(ay, px));
  }
}
