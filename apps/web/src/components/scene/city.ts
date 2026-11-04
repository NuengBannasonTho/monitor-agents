import type { Color, Palette } from './pixels';
import type { PixelBuffer } from './pixels';
import { PIXEL, bayer, hash2, parseColor, parsePalette, sprite, withAlpha } from './pixels';
import type { SceneTheme } from './useSceneTheme';

/* ------------------------------------------------------------------ */
/* Layout shared with the desk grid                                    */
/* ------------------------------------------------------------------ */

/** Sidewalk rows between the buildings and the plaza. */
export const SIDEWALK_ROWS = 5;

/** Art row where the plaza starts (bottom of the sidewalk curb). */
export function cityHorizonArt(heightArt: number): number {
  return Math.round(Math.min(34, Math.max(22, heightArt * 0.26)));
}

/** Same line in CSS px, for placing desks on the plaza. */
export function cityHorizonPx(heightPx: number): number {
  return cityHorizonArt(Math.ceil(heightPx / PIXEL)) * PIXEL;
}

/* ------------------------------------------------------------------ */
/* Palettes                                                            */
/* ------------------------------------------------------------------ */

type CityKey =
  | 'sky0'
  | 'sky1'
  | 'sky2'
  | 'sky3'
  | 'cloud'
  | 'cloudShade'
  | 'sun'
  | 'sunCore'
  | 'star'
  | 'starDim'
  | 'far'
  | 'farWindow'
  | 'farLit'
  | 'roof'
  | 'antenna'
  | 'beacon'
  | 'door'
  | 'windowDark'
  | 'windowShine'
  | 'windowLit'
  | 'windowWarm'
  | 'windowTv'
  | 'awningA'
  | 'awningB'
  | 'sidewalk'
  | 'sidewalkJoint'
  | 'sidewalkShade'
  | 'curb'
  | 'curbTop'
  | 'tileA'
  | 'tileB'
  | 'tileC'
  | 'grout'
  | 'pole'
  | 'poleDark'
  | 'lampHead'
  | 'lampLight'
  | 'planter'
  | 'planterDark'
  | 'leafDark'
  | 'leaf'
  | 'leafLight'
  | 'trunk';

interface BuildingStyle {
  readonly wall: Color;
  readonly shade: Color;
  readonly trim: Color;
}

const DAY: Palette<CityKey> = parsePalette({
  sky0: '#6fbdef',
  sky1: '#8fd0f6',
  sky2: '#b5e2fa',
  sky3: '#dcf2fc',
  cloud: '#ffffff',
  cloudShade: '#d3ebf8',
  sun: '#ffe07a',
  sunCore: '#fff6c8',
  star: '#ffffff',
  starDim: '#ffffff',
  far: '#a7c3da',
  farWindow: '#bdd5e8',
  farLit: '#bdd5e8',
  roof: '#5b6172',
  antenna: '#4a4f5e',
  beacon: '#d8404f',
  door: '#4a3a34',
  windowDark: '#4f7898',
  windowShine: '#a9d6f2',
  windowLit: '#6f97b6',
  windowWarm: '#6f97b6',
  windowTv: '#6f97b6',
  awningA: '#e24f5a',
  awningB: '#fff4ea',
  sidewalk: '#cbc5bd',
  sidewalkJoint: '#b4ada4',
  sidewalkShade: '#aaa39a',
  curb: '#8d8880',
  curbTop: '#e3ded7',
  tileA: '#dad3c9',
  tileB: '#d1c9be',
  tileC: '#e2dcd3',
  grout: '#bfb7ab',
  pole: '#3e4454',
  poleDark: '#2c303c',
  lampHead: '#eef0f2',
  lampLight: '#ffe7a3',
  planter: '#9097a5',
  planterDark: '#6f7583',
  leafDark: '#2f7d44',
  leaf: '#48a052',
  leafLight: '#74c464',
  trunk: '#6b4a2f',
});

const NIGHT: Palette<CityKey> = parsePalette({
  sky0: '#0b0f2a',
  sky1: '#11173a',
  sky2: '#1a2150',
  sky3: '#2a2d63',
  cloud: '#2b3164',
  cloudShade: '#222857',
  sun: '#f1ecd0',
  sunCore: '#fffbe6',
  star: '#ffffff',
  starDim: '#8d97d0',
  far: '#1b2147',
  farWindow: '#252c5a',
  farLit: '#c9a75a',
  roof: '#1b1d2c',
  antenna: '#2a2d3e',
  beacon: '#ff4d5e',
  door: '#2a2228',
  windowDark: '#181d36',
  windowShine: '#232a4a',
  windowLit: '#ffd56e',
  windowWarm: '#f2a94e',
  windowTv: '#86b8ff',
  awningA: '#9c3a46',
  awningB: '#6e6470',
  sidewalk: '#383a49',
  sidewalkJoint: '#2f3140',
  sidewalkShade: '#2a2c39',
  curb: '#22242f',
  curbTop: '#4a4c5d',
  tileA: '#2b2e3c',
  tileB: '#282a37',
  tileC: '#2f3242',
  grout: '#20222d',
  pole: '#242734',
  poleDark: '#1a1c26',
  lampHead: '#ffe7a3',
  lampLight: '#ffd27a',
  planter: '#3c3f4e',
  planterDark: '#2b2d3a',
  leafDark: '#0f2a24',
  leaf: '#183d31',
  leafLight: '#235441',
  trunk: '#3a2b28',
});

const DAY_BUILDINGS: readonly BuildingStyle[] = [
  { wall: '#d98f62', shade: '#b8714a', trim: '#f0c9a6' },
  { wall: '#c7d0da', shade: '#a5b0bd', trim: '#e6ebf0' },
  { wall: '#8ea6bd', shade: '#738aa1', trim: '#b9cadb' },
  { wall: '#e4c17b', shade: '#c4a05e', trim: '#f4dfae' },
  { wall: '#b78db2', shade: '#987193', trim: '#d8bcd4' },
  { wall: '#7fb6a3', shade: '#649886', trim: '#b2d8ca' },
].map((s) => ({ wall: parseColor(s.wall), shade: parseColor(s.shade), trim: parseColor(s.trim) }));

const NIGHT_BUILDINGS: readonly BuildingStyle[] = [
  { wall: '#3d2f3f', shade: '#2e2330', trim: '#4f3e50' },
  { wall: '#2c3550', shade: '#212840', trim: '#3a4566' },
  { wall: '#333a4d', shade: '#262c3c', trim: '#434b62' },
  { wall: '#3b3646', shade: '#2c2836', trim: '#4c4659' },
  { wall: '#2a3a47', shade: '#1f2c37', trim: '#384c5b' },
  { wall: '#352f4f', shade: '#28233d', trim: '#453d63' },
].map((s) => ({ wall: parseColor(s.wall), shade: parseColor(s.shade), trim: parseColor(s.trim) }));

const CLOUD = sprite([
  '......wwww......',
  '...wwwwwwwww....',
  '..wwwwwwwwwwwww.',
  '.wwwwwwwwwwwwwww',
  '.sssssssssssss..',
]);

const STREET_TREE = sprite([
  '..ddddd..',
  '.dmllmmd.',
  'dmlhlmmmd',
  'dmllmmmmd',
  'dmmmmmmdd',
  '.ddmmmdd.',
  '....t....',
  '....t....',
  '.ppppppp.',
  '.PPPPPPP.',
]);

/* ------------------------------------------------------------------ */
/* Painting                                                            */
/* ------------------------------------------------------------------ */

function disc(buf: PixelBuffer, cx: number, cy: number, r: number, color: Color): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) buf.set(x, y, color);
    }
  }
}

/** Dithered light pool: a few flat alpha steps, the pixel-art way to draw a gradient. */
function glow(
  buf: PixelBuffer,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: Color,
  strength: number,
): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if (d >= 1) continue;
      const level = Math.min(3, Math.floor((1 - d) * 3 + bayer(x, y)));
      if (level > 0) buf.set(x, y, withAlpha(color, level * strength));
    }
  }
}

function paintBuilding(
  buf: PixelBuffer,
  p: Palette<CityKey>,
  style: BuildingStyle,
  night: boolean,
  x: number,
  top: number,
  w: number,
  base: number,
  id: number,
): void {
  const h = base - top;
  buf.rect(x, top, w, h, style.wall);
  buf.rect(x + w - 1, top, 1, h, style.shade);
  buf.rect(x, top, w, 1, style.trim);
  buf.rect(x - 1, top - 1, w + 2, 1, p.roof);

  // Window grid, skipping the ground floor.
  const winW = w >= 14 && hash2(id, 1, 71) < 0.5 ? 3 : 2;
  const stepX = winW + 1 + (w >= 16 ? 1 : 0);
  const cols = Math.max(1, Math.floor((w - 3) / stepX));
  const left = x + Math.floor((w - (cols * stepX - 1)) / 2);
  const floorH = 4;
  const groundFloor = base - 5;
  for (let row = 0, wy = top + 3; wy + 2 <= groundFloor; row++, wy += floorH) {
    for (let col = 0; col < cols; col++) {
      const wx = left + col * stepX;
      const r = hash2(id * 64 + col, row, 72);
      let color = p.windowDark;
      if (night) {
        if (r < 0.32) color = p.windowLit;
        else if (r < 0.42) color = p.windowWarm;
        else if (r < 0.47) color = p.windowTv;
      }
      buf.rect(wx, wy, winW, 2, color);
      if (!night) buf.set(wx, wy, p.windowShine);
    }
  }

  // Ground floor: a shop with an awning, or a plain door.
  const doorX = x + Math.floor(w / 2) - 1;
  if (w >= 11 && hash2(id, 2, 73) < 0.55) {
    for (let ax = x + 1; ax < x + w - 1; ax++) {
      buf.set(ax, base - 5, (ax - x) % 2 === 0 ? p.awningA : p.awningB);
      buf.set(ax, base - 4, (ax - x) % 2 === 0 ? p.awningB : p.awningA);
    }
    buf.rect(x + 2, base - 3, w - 4, 2, night ? p.windowWarm : p.windowDark);
    if (!night) buf.rect(x + 2, base - 3, 1, 1, p.windowShine);
    buf.rect(doorX, base - 3, 2, 3, p.door);
  } else {
    buf.rect(doorX, base - 3, 2, 3, p.door);
    buf.rect(doorX - 1, base - 4, 4, 1, style.trim);
  }

  // Something on the roof.
  const roofKind = hash2(id, 3, 74);
  if (roofKind < 0.35) {
    const ax = x + 2 + Math.floor(hash2(id, 4, 74) * Math.max(1, w - 4));
    const ah = 3 + Math.floor(hash2(id, 5, 74) * 3);
    buf.rect(ax, top - 1 - ah, 1, ah, p.antenna);
    buf.set(ax, top - 2 - ah, p.beacon);
  } else if (roofKind < 0.55 && w >= 10) {
    const tx = x + w - 6;
    buf.rect(tx, top - 5, 4, 3, style.shade);
    buf.rect(tx, top - 5, 4, 1, p.roof);
    buf.set(tx, top - 2, p.antenna);
    buf.set(tx + 3, top - 2, p.antenna);
  } else if (roofKind < 0.75) {
    buf.rect(x + 1, top - 3, 3, 2, p.planterDark);
    buf.set(x + 2, top - 3, p.planter);
  }
}

export function cityPalette(theme: SceneTheme): Palette<CityKey> {
  return theme === 'night' ? NIGHT : DAY;
}

export function paintCity(buf: PixelBuffer, theme: SceneTheme): void {
  const night = theme === 'night';
  const p = cityPalette(theme);
  const styles = night ? NIGHT_BUILDINGS : DAY_BUILDINGS;
  const { width: w, height: h } = buf;
  const horizon = cityHorizonArt(h);
  const ground = horizon - SIDEWALK_ROWS;

  // Sky: four bands blended with ordered dithering.
  const bands = [p.sky0, p.sky1, p.sky2, p.sky3] as const;
  for (let y = 0; y < ground; y++) {
    const t = (y / Math.max(1, ground - 1)) * (bands.length - 1);
    for (let x = 0; x < w; x++) {
      const i = Math.min(bands.length - 1, Math.floor(t + bayer(x, y) - 0.25));
      buf.set(x, y, bands[Math.max(0, i)] ?? p.sky0);
    }
  }

  if (night) {
    for (let y = 0; y < ground - 6; y++) {
      for (let x = 0; x < w; x++) {
        const r = hash2(x, y, 81);
        if (r < 0.006) buf.set(x, y, p.star);
        else if (r < 0.016) buf.set(x, y, p.starDim);
      }
    }
    // Crescent moon.
    const mx = Math.round(w * 0.82);
    disc(buf, mx, 6, 3.4, p.sun);
    disc(buf, mx + 1.6, 5.2, 2.8, p.sky0);
  } else {
    const sx = Math.round(w * 0.84);
    glow(buf, sx, 6, 9, 9, p.sunCore, 0.12);
    disc(buf, sx, 6, 3.6, p.sun);
    disc(buf, sx - 0.6, 5.4, 2.2, p.sunCore);
  }
  const cloudColors = { w: p.cloud, s: p.cloudShade };
  buf.sprite(CLOUD, cloudColors, Math.round(w * 0.08), 3);
  if (w > 80) buf.sprite(CLOUD, cloudColors, Math.round(w * 0.5), 8, true);

  // Far skyline silhouettes.
  for (let i = 0, x = -2; x < w; i++) {
    const bw = 5 + Math.floor(hash2(i, 0, 82) * 8);
    const bh = Math.floor(ground * (0.42 + hash2(i, 1, 82) * 0.33));
    const top = ground - bh;
    buf.rect(x, top, bw, bh, p.far);
    for (let wy = top + 2; wy < ground - 2; wy += 3) {
      for (let wx = x + 1; wx < x + bw - 1; wx += 2) {
        const r = hash2(wx, wy, 83);
        if (r < 0.12) buf.set(wx, wy, p.farLit);
        else if (r < 0.4 && !night) buf.set(wx, wy, p.farWindow);
      }
    }
    x += bw + (hash2(i, 2, 82) < 0.3 ? 1 : 0);
  }

  // Near buildings.
  for (let i = 0, x = -Math.floor(hash2(0, 9, 84) * 4); x < w; i++) {
    const bw = 9 + Math.floor(hash2(i, 0, 84) * 10);
    const bh = Math.max(9, Math.floor((ground - 4) * (0.38 + hash2(i, 1, 84) * 0.55)));
    const style = styles[Math.floor(hash2(i, 2, 84) * styles.length)] ?? styles[0];
    if (style !== undefined) paintBuilding(buf, p, style, night, x, ground - bh, bw, ground, i);
    x += bw + (hash2(i, 3, 84) < 0.35 ? 1 : 0);
  }

  // Sidewalk with joints, then the curb.
  for (let y = ground; y < horizon; y++) {
    for (let x = 0; x < w; x++) {
      let color = p.sidewalk;
      if (y === ground) color = p.sidewalkShade;
      else if (y === horizon - 2) color = p.curbTop;
      else if (y === horizon - 1) color = p.curb;
      else if (x % 7 === 0) color = p.sidewalkJoint;
      buf.set(x, y, color);
    }
  }

  // Plaza pavers in running bond.
  for (let y = horizon; y < h; y++) {
    const row = Math.floor((y - horizon) / 3);
    const ly = (y - horizon) % 3;
    const offset = (row % 2) * 3;
    for (let x = 0; x < w; x++) {
      const lx = (x + offset) % 6;
      if (lx === 5 || ly === 2) {
        buf.set(x, y, p.grout);
        continue;
      }
      const r = hash2(Math.floor((x + offset) / 6), row, 85);
      buf.set(x, y, r < 0.18 ? p.tileB : r > 0.9 ? p.tileC : p.tileA);
    }
  }

  // Street lamps and little trees in planters along the sidewalk.
  const treeColors = {
    d: p.leafDark,
    m: p.leaf,
    l: p.leafLight,
    h: p.leafLight,
    t: p.trunk,
    p: p.planter,
    P: p.planterDark,
  };
  for (let x = 6; x < w; x += 24) {
    const top = horizon - 15;
    if (night) glow(buf, x + 0.5, top + 1, 4, 4, p.lampLight, 0.1);
    buf.rect(x, top + 2, 1, 13, p.pole);
    buf.rect(x - 1, horizon - 2, 3, 1, p.poleDark);
    buf.rect(x - 1, top, 3, 2, p.lampHead);
    buf.rect(x - 1, top - 1, 3, 1, p.poleDark);
    const treeX = x + 12 - 4;
    if (treeX + 9 < w + 4) buf.sprite(STREET_TREE, treeColors, treeX, horizon - 11);
  }
}
