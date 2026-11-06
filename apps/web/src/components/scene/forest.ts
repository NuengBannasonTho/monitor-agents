import { seededRandom } from '../../lib/seed';
import type { Color, Palette, PixelBuffer, Sprite } from './pixels';
import { bayer, hash2, parsePalette, sprite, valueNoise, withAlpha } from './pixels';
import type { Disc, Tones } from './raster';
import { blob, eachPixel, ellipseCss, pine, rectCss } from './raster';
import type { SceneTheme } from './use-scene-theme';

/*
 * The lounge as a forest glade. Every size below is in CSS px; `px` (CSS px per art pixel)
 * only decides how finely it is drawn. Only the tiny props (flowers, tufts, mushrooms) have
 * hand-drawn sprites, one coarse set and one fine set.
 */

/* ------------------------------------------------------------------ */
/* Palettes                                                            */
/* ------------------------------------------------------------------ */

type ForestKey =
  | 'grass'
  | 'grassDark'
  | 'grassLight'
  | 'tuft'
  | 'deep'
  | 'path'
  | 'pathDark'
  | 'pathEdge'
  | 'pebble'
  | 'canopyEdge'
  | 'canopyDark'
  | 'canopy'
  | 'canopyLight'
  | 'canopyHi'
  | 'pineEdge'
  | 'pineDark'
  | 'pine'
  | 'pineLight'
  | 'trunk'
  | 'trunkDark'
  | 'shadow'
  | 'flowerA'
  | 'flowerB'
  | 'flowerC'
  | 'flowerD'
  | 'flowerEye'
  | 'stem'
  | 'cap'
  | 'capDot'
  | 'mushStem'
  | 'rockEdge'
  | 'rock'
  | 'rockDark'
  | 'rockLight'
  | 'water'
  | 'waterDeep'
  | 'waterLight'
  | 'shore'
  | 'lily'
  | 'lilyFlower'
  | 'reed'
  | 'cattail'
  | 'bark'
  | 'barkDark'
  | 'logEnd'
  | 'logRing'
  | 'stone'
  | 'stoneDark'
  | 'berry'
  | 'glow';

const DAY: Palette<ForestKey> = parsePalette({
  grass: '#6abf4b',
  grassDark: '#56a83f',
  grassLight: '#84d05f',
  tuft: '#3f8f35',
  deep: '#1f5131',
  path: '#d9b47a',
  pathDark: '#c59d63',
  pathEdge: '#a8834f',
  pebble: '#ecd5a6',
  canopyEdge: '#1b4a2b',
  canopyDark: '#245f37',
  canopy: '#2f7d44',
  canopyLight: '#48a052',
  canopyHi: '#74c464',
  pineEdge: '#153f2a',
  pineDark: '#1c5236',
  pine: '#276b47',
  pineLight: '#3d8d59',
  trunk: '#7a5232',
  trunkDark: '#553720',
  shadow: '#1a3a1a40',
  flowerA: '#ffd94a',
  flowerB: '#ff8fbc',
  flowerC: '#fff8ec',
  flowerD: '#9ec3ff',
  flowerEye: '#e0782c',
  stem: '#3f8f35',
  cap: '#d9443b',
  capDot: '#fff3e8',
  mushStem: '#f1e1c6',
  rockEdge: '#5f616b',
  rock: '#a5a6ad',
  rockDark: '#7e8089',
  rockLight: '#cacbd1',
  water: '#4ba7de',
  waterDeep: '#3887c2',
  waterLight: '#a4e0fa',
  shore: '#8a7448',
  lily: '#3c963c',
  lilyFlower: '#ffd1e2',
  reed: '#3f7f3a',
  cattail: '#7a4d2c',
  bark: '#8b5b34',
  barkDark: '#5f3c22',
  logEnd: '#e0b97f',
  logRing: '#a8784a',
  stone: '#93949b',
  stoneDark: '#6d6f78',
  berry: '#e8414f',
  glow: '#ffb347',
});

const NIGHT: Palette<ForestKey> = parsePalette({
  grass: '#2b5643',
  grassDark: '#234a3a',
  grassLight: '#34634d',
  tuft: '#1c3f31',
  deep: '#0a1a18',
  path: '#5d5468',
  pathDark: '#51495c',
  pathEdge: '#413a4b',
  pebble: '#706879',
  canopyEdge: '#09201b',
  canopyDark: '#0e2622',
  canopy: '#15372e',
  canopyLight: '#1f4c3c',
  canopyHi: '#2c6450',
  pineEdge: '#071a17',
  pineDark: '#0b221f',
  pine: '#12322b',
  pineLight: '#1c4639',
  trunk: '#3d2d2a',
  trunkDark: '#291e1c',
  shadow: '#00000050',
  flowerA: '#cdb34e',
  flowerB: '#b56d8d',
  flowerC: '#c4c0d4',
  flowerD: '#7489c0',
  flowerEye: '#9a5a32',
  stem: '#1c3f31',
  cap: '#93363a',
  capDot: '#c7bfd0',
  mushStem: '#a9a0a8',
  rockEdge: '#2c2e3b',
  rock: '#55586a',
  rockDark: '#3e4152',
  rockLight: '#6d7086',
  water: '#1d3a60',
  waterDeep: '#152c4c',
  waterLight: '#7d9fd0',
  shore: '#3a3340',
  lily: '#1d4a35',
  lilyFlower: '#b391b0',
  reed: '#1e3f30',
  cattail: '#3d2a24',
  bark: '#4a3530',
  barkDark: '#322422',
  logEnd: '#7d6656',
  logRing: '#5e4a40',
  stone: '#4f5162',
  stoneDark: '#393b4a',
  berry: '#a3344a',
  glow: '#ffa53d',
});

export function forestPalette(theme: SceneTheme): Palette<ForestKey> {
  return theme === 'night' ? NIGHT : DAY;
}

/* ------------------------------------------------------------------ */
/* Tiny props: one sprite set per detail level                         */
/* ------------------------------------------------------------------ */

interface SmallProps {
  readonly flower: Sprite;
  readonly mushroom: Sprite;
  readonly tuft: Sprite;
  readonly berries: readonly (readonly [number, number])[];
}

const COARSE: SmallProps = {
  flower: sprite(['.p.', 'pcp', '.s.']),
  mushroom: sprite(['.rr.', 'rwrr', '.ss.']),
  tuft: sprite(['k.k.k', '.kkk.']),
  berries: [
    [-1, -1],
    [1, 0],
  ],
};

const FINE: SmallProps = {
  flower: sprite(['.p.p.', 'ppcpp', '.ppp.', '..s..', '.ss..', '..s..']),
  mushroom: sprite(['..rrr..', '.rrwrr.', 'rwrrrwr', 'rrrrrrr', '..sss..', '..sss..']),
  tuft: sprite(['k....k...k', '.k..k.k.k.', '.k.k..kk..', '..kk...k..']),
  berries: [
    [-2, -1],
    [1, -2],
    [3, 0],
    [-1, 1],
  ],
};

/** Fine sprites once pixels are small enough to show them. */
function smallProps(px: number): SmallProps {
  return px <= 3 ? FINE : COARSE;
}

/* ------------------------------------------------------------------ */
/* Layout (CSS px)                                                     */
/* ------------------------------------------------------------------ */

export interface Ellipse {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
}

export interface ForestLandmarks {
  /** Center of the fire pit. The flames are drawn on top by the DOM overlay. */
  readonly camp: { readonly x: number; readonly y: number };
  readonly clearing: Ellipse;
  readonly pond: Ellipse | null;
  /** Where the trunks of the front tree line stand. */
  readonly treeLine: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Fixed spots shared by the painted ground and the animated overlay. */
export function forestLandmarks(width: number, height: number): ForestLandmarks {
  const treeLine = clamp(height * 0.1, 40, 70);
  const camp = { x: width * 0.54, y: treeLine + (height - treeLine) * 0.48 };
  const crx = clamp(width * 0.15, 45, 80);
  const clearing = { x: camp.x, y: camp.y + 5, rx: crx, ry: crx * 0.6 };
  const prx = clamp(width * 0.11, 30, 65);
  const pond =
    width >= 250 && height >= 300
      ? { x: width * 0.2, y: height * 0.8, rx: prx, ry: Math.max(15, prx * 0.5) }
      : null;
  return { camp, clearing, pond, treeLine };
}

function ellipseDist(e: Ellipse, x: number, y: number): number {
  const dx = (x - e.x) / e.rx;
  const dy = (y - e.y) / e.ry;
  return dx * dx + dy * dy;
}

/** Center and half-width of the dirt trail at height y, or null where there is none. */
function trailAt(l: ForestLandmarks, width: number, height: number, y: number) {
  const { camp, treeLine } = l;
  if (y >= camp.y) {
    // Down from the clearing to the bottom edge, widening a little toward the viewer.
    const t = (y - camp.y) / Math.max(1, height - camp.y);
    return {
      cx: camp.x + Math.sin(t * Math.PI * 1.5) * width * 0.12 * Math.min(1, t * 2),
      half: 10 + t * 8,
    };
  }
  if (y >= treeLine) {
    // Up and to the left, disappearing into the tree line.
    const t = (camp.y - y) / Math.max(1, camp.y - treeLine);
    return { cx: camp.x - t * width * 0.2 + Math.sin(t * 4) * 10, half: 10 - t * 3 };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Painting                                                            */
/* ------------------------------------------------------------------ */

interface Prop {
  readonly baseY: number;
  readonly draw: () => void;
}

export function paintForest(buf: PixelBuffer, px: number, theme: SceneTheme): void {
  const p = forestPalette(theme);
  const small = smallProps(px);
  const fine = px <= 3;
  const w = buf.width * px;
  const h = buf.height * px;
  const l = forestLandmarks(w, h);
  const c = l.clearing;
  const rand = seededRandom(0xf0e57);
  const night = theme === 'night';
  const canopyTones: Tones = {
    edge: p.canopyEdge,
    dark: p.canopyDark,
    mid: p.canopy,
    light: p.canopyLight,
    hi: p.canopyHi,
  };
  const pineTones: Tones = {
    edge: p.pineEdge,
    dark: p.pineDark,
    mid: p.pine,
    light: p.pineLight,
    hi: p.pineLight,
  };
  const all = { left: 0, top: 0, right: w, bottom: h };

  // Ground: soft value-noise patches, quantised with ordered dithering.
  eachPixel(buf, px, all, (ax, ay, x, y) => {
    const n = valueNoise(x / 45, y / 35, 11) * 0.75 + valueNoise(x / 15, y / 15, 12) * 0.25;
    const v = n + (bayer(ax, ay) - 0.5) * 0.22;
    let color = v < 0.36 ? p.grassDark : v > 0.68 ? p.grassLight : p.grass;
    if (fine) {
      // Single blades of grass catch the light.
      const r = hash2(ax, ay, 13);
      if (r < 0.03) color = p.grassDark;
      else if (r > 0.975) color = p.grassLight;
    }
    buf.set(ax, ay, color);
  });

  // Clearing around the fire, with a ragged dithered edge.
  eachPixel(
    buf,
    px,
    {
      left: c.x - c.rx - px,
      top: c.y - c.ry - px,
      right: c.x + c.rx + px,
      bottom: c.y + c.ry + px,
    },
    (ax, ay, x, y) => {
      const d = ellipseDist(c, x, y) + (hash2(ax, ay, 21) - 0.5) * 0.25;
      if (d < 0.72) buf.set(ax, ay, hash2(ax, ay, 22) < 0.12 ? p.pathDark : p.path);
      else if (d < 1 && bayer(ax, ay) < (1 - d) * 3) buf.set(ax, ay, p.pathDark);
    },
  );

  // Trail.
  eachPixel(buf, px, all, (ax, ay, x, y) => {
    const seg = trailAt(l, w, h, y);
    if (seg === null) return;
    const dist = Math.abs(x - seg.cx);
    if (dist > seg.half + px * 0.6) return;
    if (dist > seg.half - px * 0.4) {
      if (hash2(ax, ay, 31) < 0.7) buf.set(ax, ay, p.pathEdge);
    } else {
      const r = hash2(ax, ay, 32);
      buf.set(ax, ay, r < 0.08 ? p.pebble : r < 0.22 ? p.pathDark : p.path);
    }
  });

  // Pond.
  if (l.pond !== null) {
    const pond = l.pond;
    const shore: Ellipse = { ...pond, rx: pond.rx + 7, ry: pond.ry + 6 };
    eachPixel(
      buf,
      px,
      {
        left: shore.x - shore.rx,
        top: shore.y - shore.ry,
        right: shore.x + shore.rx,
        bottom: shore.y + shore.ry,
      },
      (ax, ay, x, y) => {
        const d = ellipseDist(pond, x, y);
        if (d <= 1) {
          const ripple = hash2(Math.floor(x / 15), ay, 41) < 0.09 && d < 0.6;
          const deep = d > 0.62 || y < pond.y - pond.ry * 0.3;
          buf.set(ax, ay, ripple ? p.waterLight : deep ? p.waterDeep : p.water);
        } else if (ellipseDist(shore, x, y) <= 1) {
          buf.set(ax, ay, p.shore);
        }
      },
    );
    if (night) {
      // Moon on the water.
      rectCss(buf, px, pond.x + 5, pond.y - 5, 15, Math.max(px, 4), p.waterLight);
      rectCss(buf, px, pond.x, pond.y + 5, 10, Math.max(px, 4), p.waterLight);
    }
    // Lily pads with a notch, one in flower.
    for (const [dx, dy, flower] of [
      [-0.5, -0.1, true],
      [0.35, 0.25, false],
    ] as const) {
      const lx = pond.x + pond.rx * dx;
      const ly = pond.y + pond.ry * dy;
      ellipseCss(buf, px, lx, ly, 8, 6, p.lily);
      rectCss(buf, px, lx, ly - 6, Math.max(px, 4), 6, p.water);
      if (flower)
        ellipseCss(
          buf,
          px,
          lx - 2,
          ly - 1,
          Math.max(px / 2, 2.5),
          Math.max(px / 2, 2.5),
          p.lilyFlower,
        );
    }
    // Reeds on the far side.
    const reedW = Math.max(px, 3);
    for (const dx of [-pond.rx + 5, -pond.rx + 15, pond.rx - 10]) {
      const rx = pond.x + dx;
      const ry = pond.y - pond.ry * 0.7;
      rectCss(buf, px, rx, ry - 15, reedW, 20, p.reed);
      rectCss(buf, px, rx - (fine ? px / 2 : 0), ry - 27, reedW + (fine ? px : 0), 12, p.cattail);
    }
  }

  // Warm light around the fire after dark.
  if (night) {
    const radius = Math.max(c.rx + 30, 70);
    eachPixel(
      buf,
      px,
      {
        left: l.camp.x - radius,
        top: l.camp.y - radius,
        right: l.camp.x + radius,
        bottom: l.camp.y + radius,
      },
      (ax, ay, x, y) => {
        const dist = Math.hypot(x - l.camp.x, (y - l.camp.y) * 1.5) / radius;
        if (dist >= 1) return;
        const level = Math.floor((1 - dist) * 4 + bayer(ax, ay));
        if (level > 0) buf.set(ax, ay, withAlpha(p.glow, Math.min(4, level) * 0.07));
      },
    );
  }

  const blocked = (x: number, y: number, margin = 0): boolean => {
    if (y < l.treeLine + 15 || x < 10 || x > w - 15) return true;
    if (ellipseDist({ ...c, rx: c.rx + margin, ry: c.ry + margin }, x, y) < 1.1) return true;
    if (l.pond !== null) {
      const pd = l.pond;
      if (ellipseDist({ ...pd, rx: pd.rx + 10 + margin, ry: pd.ry + 10 + margin }, x, y) < 1) {
        return true;
      }
    }
    const seg = trailAt(l, w, h, y);
    return seg !== null && Math.abs(x - seg.cx) < seg.half + 10 + margin;
  };

  const props: Prop[] = [];
  const add = (baseY: number, draw: () => void): void => {
    props.push({ baseY, draw });
  };

  const shadow = (cx: number, baseY: number, rx: number): void => {
    ellipseCss(buf, px, cx, baseY, rx, rx * 0.3, p.shadow);
  };

  const roundTree = (cx: number, baseY: number, size: number, salt: number): void => {
    add(baseY, () => {
      const r = size * 0.5;
      const trunkW = Math.max(px * 2, size * 0.2);
      const trunkH = size * 0.42;
      shadow(cx, baseY, r * 0.75);
      rectCss(buf, px, cx - trunkW / 2, baseY - trunkH, trunkW / 2, trunkH, p.trunk);
      rectCss(buf, px, cx, baseY - trunkH, trunkW / 2, trunkH, p.trunkDark);
      const cy = baseY - trunkH - r * 0.7;
      const j = (k: number): number => (hash2(salt, k, 52) - 0.5) * r * 0.25;
      const discs: Disc[] = [
        { x: cx + j(1), y: cy + j(2), r },
        { x: cx - r * 0.58 + j(3), y: cy + r * 0.28, r: r * 0.62 },
        { x: cx + r * 0.58 + j(4), y: cy + r * 0.24, r: r * 0.6 },
        { x: cx - r * 0.22 + j(5), y: cy - r * 0.55, r: r * 0.56 },
        { x: cx + r * 0.3 + j(6), y: cy - r * 0.42, r: r * 0.5 },
      ];
      blob(buf, px, discs, canopyTones, { salt, texture: fine ? 0.45 : 0.2 });
    });
  };

  const pineTree = (cx: number, baseY: number, size: number): void => {
    add(baseY, () => {
      shadow(cx, baseY, size * 0.28);
      pine(buf, px, cx, baseY, size, size * 0.6, pineTones, { light: p.trunk, dark: p.trunkDark });
    });
  };

  const tree = (cx: number, baseY: number, isPine: boolean, size: number, salt: number): void => {
    if (isPine) pineTree(cx, baseY, size * 1.2);
    else roundTree(cx, baseY, size, salt);
  };

  const bush = (cx: number, baseY: number, size: number, salt: number, berries: boolean): void => {
    add(baseY, () => {
      const r = size * 0.32;
      const discs: Disc[] = [
        { x: cx, y: baseY - r * 0.9, r },
        { x: cx - r * 0.85, y: baseY - r * 0.55, r: r * 0.72 },
        { x: cx + r * 0.85, y: baseY - r * 0.5, r: r * 0.7 },
      ];
      blob(buf, px, discs, canopyTones, { salt, texture: fine ? 0.35 : 0.15, flatBottom: baseY });
      if (!berries) return;
      for (const [bx, by] of small.berries) {
        rectCss(buf, px, cx + bx * px * 2, baseY - r + by * px * 2, px, px, p.berry);
      }
    });
  };

  // Dense forest behind the front tree line.
  eachPixel(buf, px, { left: 0, top: 0, right: w, bottom: l.treeLine - 10 }, (ax, ay, x, y) => {
    const v = valueNoise(x / 20, y / 15, 61) + (bayer(ax, ay) - 0.5) * 0.3;
    buf.set(ax, ay, v < 0.5 ? p.deep : p.canopyDark);
  });
  for (let i = 0, x = -30; x < w + 40; i++, x += 35 + Math.floor(hash2(i, 0, 62) * 20)) {
    tree(x, l.treeLine - 25 + hash2(i, 1, 62) * 15, hash2(i, 2, 62) < 0.45, 70, i + 100);
  }
  for (let i = 0, x = -10; x < w + 40; i++, x += 45 + Math.floor(hash2(i, 0, 63) * 25)) {
    tree(x, l.treeLine + 5 + hash2(i, 1, 63) * 15, hash2(i, 2, 63) < 0.5, 75, i + 200);
  }

  // Trees along both sides.
  for (let i = 0, y = l.treeLine + 70; y < h + 30; i++, y += 60 + hash2(i, 0, 64) * 30) {
    tree(5 + hash2(i, 1, 64) * 20 - 10, y, hash2(i, 2, 64) < 0.5, 75, i + 300);
    tree(w - 10 + hash2(i, 3, 64) * 20 - 5, y + 25, hash2(i, 4, 64) < 0.5, 75, i + 400);
  }

  // A lone tree inside the glade when there is room for it.
  if (w >= 450 && h >= 500) roundTree(w * 0.8, h * 0.4, 80, 500);

  // Bushes along the bottom, leaving the trail open.
  const bottomTrail = trailAt(l, w, h, h - px);
  for (let i = 0, x = -15; x < w; i++, x += 50 + hash2(i, 0, 65) * 30) {
    if (bottomTrail !== null && Math.abs(x + 20 - bottomTrail.cx) < 45) continue;
    bush(x + 22, h + 2 - hash2(i, 1, 65) * 10, 45, i + 600, hash2(i, 2, 65) < 0.4);
  }

  // Scattered details. Finer pixels make smaller props, so place more of them.
  const area = (w * h) / (fine ? 2800 : 4250);
  const scatter = (
    count: number,
    margin: number,
    place: (x: number, y: number, r: number) => void,
  ) => {
    for (let i = 0, tries = 0; i < count && tries < count * 6; tries++) {
      const x = rand() * w;
      const y = l.treeLine + 15 + rand() * (h - l.treeLine - 20);
      const r = rand();
      if (blocked(x, y, margin)) continue;
      place(x, y, r);
      i++;
    }
  };
  const spriteAt = (
    s: Sprite,
    colors: Readonly<Record<string, Color>>,
    x: number,
    y: number,
    flip = false,
  ) => {
    const ax = Math.round(x / px - s.width / 2);
    const ay = Math.round(y / px) - s.height + 1;
    add(y, () => {
      buf.sprite(s, colors, ax, ay, flip);
    });
  };
  const flowerKeys = [p.flowerA, p.flowerB, p.flowerC, p.flowerD] as const;
  scatter(Math.round(area * 1.4), 0, (x, y, r) => {
    spriteAt(small.tuft, { k: p.tuft }, x, y, r < 0.5);
  });
  scatter(Math.round(area), 0, (x, y, r) => {
    const petal = flowerKeys[Math.floor(r * flowerKeys.length)] ?? p.flowerA;
    spriteAt(small.flower, { p: petal, c: p.flowerEye, s: p.stem }, x, y);
  });
  scatter(Math.max(2, Math.round(w / 150)), 5, (x, y, r) => {
    spriteAt(small.mushroom, { r: p.cap, w: p.capDot, s: p.mushStem }, x, y, r < 0.5);
  });
  scatter(3, 5, (x, y, r) => {
    add(y, () => {
      const size = (fine ? 9 : 12) + r * 6;
      blob(
        buf,
        px,
        [
          { x, y: y - size * 0.4, r: size },
          { x: x + size * 0.7, y: y - size * 0.2, r: size * 0.7 },
        ],
        { edge: p.rockEdge, dark: p.rockDark, mid: p.rock, light: p.rockLight, hi: p.rockLight },
        { flatBottom: y },
      );
    });
  });
  scatter(2, 10, (x, y, r) => {
    bush(x, y, 40, 700 + Math.round(r * 100), r < 0.5);
  });

  // The fire pit.
  add(l.camp.y + 8, () => {
    // Two crossed logs inside a ring of stones.
    rectCss(buf, px, l.camp.x - 14, l.camp.y - 2, 28, 6, p.bark);
    rectCss(buf, px, l.camp.x - 6, l.camp.y - 6, 12, 10, p.barkDark);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const sx = l.camp.x + Math.cos(a) * 19;
      const sy = l.camp.y + 3 + Math.sin(a) * 7;
      if (Math.sin(a) < -0.3) continue; // the back of the ring hides behind the flames
      ellipseCss(buf, px, sx, sy, 5, 4, k % 2 === 0 ? p.stone : p.stoneDark);
    }
  });

  props.sort((a, b) => a.baseY - b.baseY);
  for (const prop of props) prop.draw();
}
