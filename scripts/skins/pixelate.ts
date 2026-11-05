/**
 * Pure pixel operations for the skin importer (RGBA, 4 bytes per pixel).
 * Kept free of I/O so they can be unit-tested.
 */

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number; // exclusive
  readonly bottom: number; // exclusive
}

function colorDistance(rgba: Uint8Array, i: number, r: number, g: number, b: number): number {
  const dr = (rgba[i] ?? 0) - r;
  const dg = (rgba[i + 1] ?? 0) - g;
  const db = (rgba[i + 2] ?? 0) - b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Background color: the average of the four corner pixels. */
export function estimateBackground(
  rgba: Uint8Array,
  width: number,
  height: number,
): [number, number, number] {
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of corners) {
    r += rgba[p * 4] ?? 0;
    g += rgba[p * 4 + 1] ?? 0;
    b += rgba[p * 4 + 2] ?? 0;
  }
  return [Math.round(r / 4), Math.round(g / 4), Math.round(b / 4)];
}

/**
 * Makes the background transparent by flood-filling from every border pixel
 * through colors close to the background. Interior pixels of the same color
 * (eye highlights, white costume parts) are untouched because the outline
 * stops the fill. Mutates and returns `rgba`.
 *
 * Images whose corners are already transparent are left alone: transparent pixels
 * usually store black, and filling "black" from the border would eat the outline
 * and anything dark touching it (sunglasses, hair).
 */
export function removeBackground(
  rgba: Uint8Array,
  width: number,
  height: number,
  tolerance = 30,
): Uint8Array {
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  if (corners.some((p) => (rgba[p * 4 + 3] ?? 0) < 128)) return rgba;
  const [br, bg, bb] = estimateBackground(rgba, width, height);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const tryPush = (p: number): void => {
    if (visited[p] === 1) return;
    visited[p] = 1;
    if (colorDistance(rgba, p * 4, br, bg, bb) <= tolerance) queue[tail++] = p;
  };

  for (let x = 0; x < width; x++) {
    tryPush(x);
    tryPush((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    tryPush(y * width);
    tryPush(y * width + width - 1);
  }

  while (head < tail) {
    const p = queue[head++] ?? 0;
    rgba[p * 4 + 3] = 0;
    const x = p % width;
    if (x > 0) tryPush(p - 1);
    if (x < width - 1) tryPush(p + 1);
    if (p >= width) tryPush(p - width);
    if (p < width * (height - 1)) tryPush(p + width);
  }
  return rgba;
}

/**
 * Bounding box of clearly visible pixels (alpha >= `minAlpha`), or null if there are none.
 * Exported images often carry faint, invisible alpha noise far from the character; counting
 * it would make the crop too big and the character too small.
 */
export function opaqueBounds(
  rgba: Uint8Array,
  width: number,
  height: number,
  minAlpha = 64,
): Box | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((rgba[(y * width + x) * 4 + 3] ?? 0) < minAlpha) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return right < 0 ? null : { left, top, right: right + 1, bottom: bottom + 1 };
}

export function unionBox(boxes: readonly Box[]): Box | null {
  if (boxes.length === 0) return null;
  return boxes.reduce((a, b) => ({
    left: Math.min(a.left, b.left),
    top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  }));
}

/**
 * Square crop around `box`: horizontally centered, bottom-aligned (feet stay on
 * the same row in every image of a pack), with a small margin. May extend past
 * the image; callers pad with transparency.
 */
export function squareAround(box: Box, marginRatio = 0.03): Box {
  const w = box.right - box.left;
  const h = box.bottom - box.top;
  const side = Math.ceil(Math.max(w, h) * (1 + marginRatio * 2));
  const cx = (box.left + box.right) / 2;
  const left = Math.round(cx - side / 2);
  const bottom = box.bottom + Math.round(side * marginRatio);
  return { left, top: bottom - side, right: left + side, bottom };
}

/** Hard alpha: pixel art has no partial transparency. Mutates and returns `rgba`. */
export function thresholdAlpha(rgba: Uint8Array, cutoff = 110): Uint8Array {
  for (let i = 3; i < rgba.length; i += 4) {
    rgba[i] = (rgba[i] ?? 0) >= cutoff ? 255 : 0;
  }
  return rgba;
}

/**
 * Copies `box` out of an RGBA image into a new buffer, filling any part of the
 * box that lies outside the image with transparency. Done by hand rather than
 * with sharp's extend + extract, whose fixed internal order (extract runs
 * before extend) produced a wider image than requested and sheared every row.
 */
export function cropWithPadding(
  rgba: Uint8Array,
  width: number,
  height: number,
  box: Box,
): Uint8Array {
  const outW = box.right - box.left;
  const outH = box.bottom - box.top;
  const out = new Uint8Array(outW * outH * 4);
  for (let y = 0; y < outH; y++) {
    const sy = box.top + y;
    if (sy < 0 || sy >= height) continue;
    const x0 = Math.max(0, -box.left);
    const x1 = Math.min(outW, width - box.left);
    if (x1 <= x0) continue;
    const src = (sy * width + box.left + x0) * 4;
    out.set(rgba.subarray(src, src + (x1 - x0) * 4), (y * outW + x0) * 4);
  }
  return out;
}
