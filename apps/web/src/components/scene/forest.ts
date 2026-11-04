import { seededRandom } from '../../lib/seed';
import type { Color, Palette, Sprite } from './pixels';
import type { PixelBuffer } from './pixels';
import { bayer, hash2, parsePalette, sprite, valueNoise, withAlpha } from './pixels';
import type { SceneTheme } from './useSceneTheme';

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
  | 'canopyDark'
  | 'canopy'
  | 'canopyLight'
  | 'canopyHi'
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
  canopyDark: '#245f37',
  canopy: '#2f7d44',
  canopyLight: '#48a052',
  canopyHi: '#74c464',
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
  canopyDark: '#0e2622',
  canopy: '#15372e',
  canopyLight: '#1f4c3c',
  canopyHi: '#2c6450',
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

/* ------------------------------------------------------------------ */
/* Sprites                                                             */
/* ------------------------------------------------------------------ */

const ROUND_TREE = sprite([
  '.....ddddd.....',
  '...ddmmlmmdd...',
  '..dmmllhllmmd..',
  '.dmmlhhhllmmmd.',
  '.dmllhhlllmmmd.',
  'dmmllllllmmmmmd',
  'dmmlllllmmmmmmd',
  'dmmmllmmmmmmmdd',
  'dmmmmmmmmmmmmdd',
  '.dmmmmmmmmmmdd.',
  '.ddmmmmmmmmddd.',
  '..dddmmmmdddd..',
  '....ddddddd....',
  '......tTT......',
  '......tTT......',
  '......tTT......',
  '.....ttTTT.....',
  '...sstTTTTss...',
]);

const PINE_TREE = sprite([
  '.....d.....',
  '....dld....',
  '...dlmmd...',
  '..dllmmmd..',
  '...dlmmd...',
  '..dllmmmd..',
  '.dllmmmmmd.',
  '..dlmmmmd..',
  '.dllmmmmmd.',
  'dllmmmmmmmd',
  '.dlmmmmmmd.',
  'dllmmmmmmdd',
  'dlmmmmmmmmd',
  'ddddmmmdddd',
  '....ddd....',
  '....tTT....',
  '....tTT....',
  '...stTTs...',
]);

const BUSH = sprite(['..ddddd..', '.dmlhlmd.', 'dmllmmmmd', 'dmmmmmmdd', '.ddddddd.']);
const BERRIES = sprite(['.........', '...r.....', '.r....r..', '.....r...', '.........']);
const FLOWER = sprite(['.p.', 'pcp', '.s.']);
const MUSHROOM = sprite(['.rr.', 'rwrr', '.ss.']);
const ROCK = sprite(['.hgg.', 'hgggk', 'gggkk']);
const TUFT = sprite(['k.k.k', '.kkk.']);
const LOG = sprite(['eebbbbbbb', 'erBbbbBbb', 'eeBBBBBBB']);
const FIRE_PIT = sprite(['...L.L...', '.g.LLL.g.', 'gGgLLLgGg', '.gGgGgGg.']);
const LILY = sprite(['.ll', 'lfl', 'll.']);

/** Lookup tables from sprite keys to scene colors. */
function treeColors(p: Palette<ForestKey>, pine: boolean): Readonly<Record<string, Color>> {
  return pine
    ? {
        d: p.pineDark,
        m: p.pine,
        l: p.pineLight,
        t: p.trunk,
        T: p.trunkDark,
        s: p.shadow,
      }
    : {
        d: p.canopyDark,
        m: p.canopy,
        l: p.canopyLight,
        h: p.canopyHi,
        t: p.trunk,
        T: p.trunkDark,
        s: p.shadow,
      };
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export interface Ellipse {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
}

export interface ForestLandmarks {
  /** Center of the fire pit, art px. The flames are drawn on top by the DOM overlay. */
  readonly camp: { readonly x: number; readonly y: number };
  readonly clearing: Ellipse;
  readonly pond: Ellipse | null;
  /** Where the trunks of the front tree line stand. */
  readonly treeLine: number;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)));
}

/** Fixed spots shared by the painted ground and the animated overlay. */
export function forestLandmarks(width: number, height: number): ForestLandmarks {
  const treeLine = clampInt(height * 0.1, 8, 14);
  const camp = {
    x: Math.round(width * 0.54),
    y: Math.round(treeLine + (height - treeLine) * 0.48),
  };
  const crx = clampInt(width * 0.15, 9, 16);
  const clearing = { x: camp.x, y: camp.y + 1, rx: crx, ry: Math.round(crx * 0.6) };
  const prx = clampInt(width * 0.11, 6, 13);
  const pond =
    width >= 50 && height >= 60
      ? {
          x: Math.round(width * 0.2),
          y: Math.round(height * 0.8),
          rx: prx,
          ry: Math.max(3, Math.round(prx * 0.5)),
        }
      : null;
  return { camp, clearing, pond, treeLine };
}

function ellipseDist(e: Ellipse, x: number, y: number): number {
  const dx = (x - e.x) / e.rx;
  const dy = (y - e.y) / e.ry;
  return dx * dx + dy * dy;
}

/** Horizontal center and half-width of the dirt trail at row y, or null where there is none. */
function trailAt(l: ForestLandmarks, width: number, height: number, y: number) {
  const { camp, treeLine } = l;
  if (y >= camp.y) {
    // Down from the clearing to the bottom edge, widening a little toward the viewer.
    const t = (y - camp.y) / Math.max(1, height - camp.y);
    return {
      cx: camp.x + Math.sin(t * Math.PI * 1.5) * width * 0.12 * Math.min(1, t * 2),
      half: 2 + t * 1.6,
    };
  }
  if (y >= treeLine) {
    // Up and to the left, disappearing into the tree line.
    const t = (camp.y - y) / Math.max(1, camp.y - treeLine);
    return { cx: camp.x - t * width * 0.2 + Math.sin(t * 4) * 2, half: 2 - t * 0.6 };
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

export function forestPalette(theme: SceneTheme): Palette<ForestKey> {
  return theme === 'night' ? NIGHT : DAY;
}

export function paintForest(buf: PixelBuffer, theme: SceneTheme): void {
  const p = forestPalette(theme);
  const { width: w, height: h } = buf;
  const l = forestLandmarks(w, h);
  const rand = seededRandom(0xf0e57);
  const night = theme === 'night';

  // Ground: soft value-noise patches, quantised with ordered dithering.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = valueNoise(x / 9, y / 7, 11) * 0.75 + valueNoise(x / 3, y / 3, 12) * 0.25;
      const v = n + (bayer(x, y) - 0.5) * 0.22;
      buf.set(x, y, v < 0.36 ? p.grassDark : v > 0.68 ? p.grassLight : p.grass);
    }
  }

  // Clearing around the fire, with a ragged dithered edge.
  const c = l.clearing;
  for (let y = c.y - c.ry - 1; y <= c.y + c.ry + 1; y++) {
    for (let x = c.x - c.rx - 1; x <= c.x + c.rx + 1; x++) {
      const d = ellipseDist(c, x, y) + (hash2(x, y, 21) - 0.5) * 0.25;
      if (d < 0.72) buf.set(x, y, hash2(x, y, 22) < 0.12 ? p.pathDark : p.path);
      else if (d < 1 && bayer(x, y) < (1 - d) * 3) buf.set(x, y, p.pathDark);
    }
  }

  // Trail.
  for (let y = 0; y < h; y++) {
    const seg = trailAt(l, w, h, y);
    if (seg === null) continue;
    for (let x = Math.floor(seg.cx - seg.half - 1); x <= Math.ceil(seg.cx + seg.half + 1); x++) {
      const dist = Math.abs(x + 0.5 - seg.cx);
      if (dist > seg.half + 0.6) continue;
      if (dist > seg.half - 0.4) {
        if (hash2(x, y, 31) < 0.7) buf.set(x, y, p.pathEdge);
      } else {
        const r = hash2(x, y, 32);
        buf.set(x, y, r < 0.08 ? p.pebble : r < 0.22 ? p.pathDark : p.path);
      }
    }
  }

  // Pond.
  if (l.pond !== null) {
    const pond = l.pond;
    const shore: Ellipse = { ...pond, rx: pond.rx + 1.5, ry: pond.ry + 1.2 };
    for (let y = pond.y - pond.ry - 2; y <= pond.y + pond.ry + 2; y++) {
      for (let x = pond.x - pond.rx - 2; x <= pond.x + pond.rx + 2; x++) {
        const d = ellipseDist(pond, x, y);
        if (d <= 1) {
          const ripple = hash2(Math.floor(x / 3), y, 41) < 0.09 && d < 0.6;
          buf.set(
            x,
            y,
            ripple ? p.waterLight : d > 0.62 || y < pond.y - pond.ry * 0.3 ? p.waterDeep : p.water,
          );
        } else if (ellipseDist(shore, x, y) <= 1) {
          buf.set(x, y, p.shore);
        }
      }
    }
    if (night) {
      // Moon on the water.
      buf.rect(pond.x + 1, pond.y - 1, 3, 1, p.waterLight);
      buf.rect(pond.x, pond.y + 1, 2, 1, p.waterLight);
    }
    const lilyColors = { l: p.lily, f: p.lilyFlower };
    buf.sprite(LILY, lilyColors, pond.x - Math.round(pond.rx * 0.5), pond.y - 1);
    if (pond.rx >= 8)
      buf.sprite(LILY, lilyColors, pond.x + Math.round(pond.rx * 0.35), pond.y + 1, true);
    // Reeds on the far side.
    for (const dx of [-pond.rx + 1, -pond.rx + 3, pond.rx - 2]) {
      const rx = pond.x + dx;
      const ry = pond.y - Math.round(pond.ry * 0.7);
      buf.rect(rx, ry - 3, 1, 4, p.reed);
      buf.set(rx, ry - 4, p.cattail);
      buf.set(rx, ry - 5, p.cattail);
    }
  }

  // Warm light around the fire after dark.
  if (night) {
    const radius = Math.max(c.rx + 6, 14);
    for (let y = l.camp.y - radius; y <= l.camp.y + radius; y++) {
      for (let x = l.camp.x - radius; x <= l.camp.x + radius; x++) {
        const dist = Math.hypot(x - l.camp.x, (y - l.camp.y) * 1.5) / radius;
        if (dist >= 1) continue;
        const level = Math.floor((1 - dist) * 4 + bayer(x, y));
        if (level > 0) buf.set(x, y, withAlpha(p.glow, Math.min(4, level) * 0.07));
      }
    }
  }

  const blocked = (x: number, y: number, margin = 0): boolean => {
    if (y < l.treeLine + 3 || x < 2 || x > w - 3) return true;
    if (ellipseDist({ ...c, rx: c.rx + margin, ry: c.ry + margin }, x, y) < 1.1) return true;
    if (l.pond !== null) {
      const pd = l.pond;
      if (ellipseDist({ ...pd, rx: pd.rx + 2 + margin, ry: pd.ry + 2 + margin }, x, y) < 1)
        return true;
    }
    const seg = trailAt(l, w, h, y);
    return seg !== null && Math.abs(x - seg.cx) < seg.half + 2 + margin;
  };

  const props: Prop[] = [];
  const addTree = (cx: number, baseY: number, pine: boolean, salt: number): void => {
    const s = pine ? PINE_TREE : ROUND_TREE;
    const colors = treeColors(p, pine);
    const flip = hash2(salt, 7, 51) < 0.5;
    props.push({
      baseY,
      draw: () => {
        buf.sprite(s, colors, cx - Math.floor(s.width / 2), baseY - s.height + 1, flip);
      },
    });
  };
  const addSprite = (
    s: Sprite,
    colors: Readonly<Record<string, Color>>,
    x: number,
    y: number,
    flip = false,
  ): void => {
    props.push({
      baseY: y + s.height - 1,
      draw: () => {
        buf.sprite(s, colors, x, y, flip);
      },
    });
  };

  // Dense forest behind the front tree line.
  for (let y = 0; y < l.treeLine - 2; y++) {
    for (let x = 0; x < w; x++) {
      const v = valueNoise(x / 4, y / 3, 61) + (bayer(x, y) - 0.5) * 0.3;
      buf.set(x, y, v < 0.5 ? p.deep : p.canopyDark);
    }
  }
  for (let i = 0, x = -6; x < w + 8; i++, x += 7 + Math.floor(hash2(i, 0, 62) * 4)) {
    addTree(x, l.treeLine - 5 + Math.floor(hash2(i, 1, 62) * 3), hash2(i, 2, 62) < 0.45, i + 100);
  }
  for (let i = 0, x = -2; x < w + 8; i++, x += 9 + Math.floor(hash2(i, 0, 63) * 5)) {
    addTree(x, l.treeLine + 1 + Math.floor(hash2(i, 1, 63) * 3), hash2(i, 2, 63) < 0.5, i + 200);
  }

  // Trees along both sides.
  for (let i = 0, y = l.treeLine + 14; y < h + 6; i++, y += 12 + Math.floor(hash2(i, 0, 64) * 6)) {
    addTree(1 + Math.floor(hash2(i, 1, 64) * 4) - 2, y, hash2(i, 2, 64) < 0.5, i + 300);
    addTree(w - 2 + Math.floor(hash2(i, 3, 64) * 4) - 1, y + 5, hash2(i, 4, 64) < 0.5, i + 400);
  }

  // A lone tree inside the glade when there is room for it.
  if (w >= 90 && h >= 100) addTree(Math.round(w * 0.8), Math.round(h * 0.4), false, 500);

  // Bushes along the bottom, leaving the trail open.
  const bushColors = { d: p.canopyDark, m: p.canopy, l: p.canopyLight, h: p.canopyHi };
  const bottomTrail = trailAt(l, w, h, h - 1);
  for (let i = 0, x = -3; x < w; i++, x += 10 + Math.floor(hash2(i, 0, 65) * 6)) {
    if (bottomTrail !== null && Math.abs(x + 4 - bottomTrail.cx) < 9) continue;
    const by = h - 4 + Math.floor(hash2(i, 1, 65) * 2);
    addSprite(BUSH, bushColors, x, by);
    if (hash2(i, 2, 65) < 0.4) addSprite(BERRIES, { r: p.berry }, x, by);
  }

  // Scattered details.
  const scatter = (
    count: number,
    margin: number,
    place: (x: number, y: number, r: number) => void,
  ) => {
    for (let i = 0, tries = 0; i < count && tries < count * 6; tries++) {
      const x = Math.floor(rand() * w);
      const y = Math.floor(l.treeLine + 3 + rand() * (h - l.treeLine - 4));
      const r = rand();
      if (blocked(x, y, margin)) continue;
      place(x, y, r);
      i++;
    }
  };
  const flowerKeys = [p.flowerA, p.flowerB, p.flowerC, p.flowerD] as const;
  scatter(Math.round((w * h) / 120), 0, (x, y) => {
    addSprite(TUFT, { k: p.tuft }, x - 2, y - 1);
  });
  scatter(Math.round((w * h) / 170), 0, (x, y, r) => {
    const petal = flowerKeys[Math.floor(r * flowerKeys.length)] ?? p.flowerA;
    addSprite(FLOWER, { p: petal, c: p.flowerEye, s: p.stem }, x - 1, y - 2);
  });
  scatter(3, 1, (x, y, r) => {
    addSprite(ROCK, { h: p.rockLight, g: p.rock, k: p.rockDark }, x - 2, y - 2, r < 0.5);
  });
  scatter(Math.max(2, Math.round(w / 30)), 1, (x, y) => {
    addSprite(MUSHROOM, { r: p.cap, w: p.capDot, s: p.mushStem }, x - 1, y - 2);
  });
  scatter(2, 2, (x, y, r) => {
    addSprite(BUSH, bushColors, x - 4, y - 4, r < 0.5);
    if (r < 0.5) addSprite(BERRIES, { r: p.berry }, x - 4, y - 4, true);
  });

  // Campfire with two log benches.
  const logColors = { e: p.logEnd, r: p.logRing, b: p.bark, B: p.barkDark };
  addSprite(FIRE_PIT, { L: p.bark, g: p.stone, G: p.stoneDark }, l.camp.x - 4, l.camp.y - 2);
  addSprite(LOG, logColors, l.camp.x - 15, l.camp.y - 2);
  addSprite(LOG, logColors, l.camp.x + 6, l.camp.y + 1, true);

  props.sort((a, b) => a.baseY - b.baseY);
  for (const prop of props) prop.draw();
}
