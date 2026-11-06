import type { Color, Palette, PixelBuffer } from './pixels';
import { bayer, hash2, mix, parseColor, parsePalette, valueNoise, withAlpha } from './pixels';
import type { Disc } from './raster';
import { blob, eachPixel, ellipseCss, rectCss, rectEach, toArt } from './raster';
import type { SceneTheme } from './use-scene-theme';

/*
 * The meeting zone as a downtown plaza. Sizes are CSS px; `px` (CSS px per art pixel)
 * only sets how finely it is drawn, and small pixels earn extra detail (window frames,
 * scalloped awnings, bevelled pavers).
 */

/* ------------------------------------------------------------------ */
/* Layout shared with the desk grid                                    */
/* ------------------------------------------------------------------ */

/** Sidewalk height between the buildings and the plaza, CSS px. */
export const SIDEWALK_PX = 25;

/** Where the plaza starts (bottom of the curb), snapped to the pixel grid. */
export function cityHorizonPx(heightPx: number, px: number): number {
  const raw = Math.min(170, Math.max(110, heightPx * 0.26));
  return toArt(raw, px) * px;
}

/* ------------------------------------------------------------------ */
/* Palettes                                                            */
/* ------------------------------------------------------------------ */

type CityKey =
  | 'ink'
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
  | 'farTop'
  | 'farWindow'
  | 'farLit'
  | 'roof'
  | 'roofHi'
  | 'antenna'
  | 'beacon'
  | 'door'
  | 'doorKnob'
  | 'windowDark'
  | 'windowSky'
  | 'windowShine'
  | 'windowLit'
  | 'windowLitTop'
  | 'windowWarm'
  | 'windowTv'
  | 'awningA'
  | 'awningB'
  | 'sidewalk'
  | 'sidewalkB'
  | 'sidewalkHi'
  | 'sidewalkJoint'
  | 'sidewalkShade'
  | 'curb'
  | 'curbTop'
  | 'curbHi'
  | 'curbJoint'
  | 'curbShadow'
  | 'tileA'
  | 'tileB'
  | 'tileC'
  | 'tileHi'
  | 'grout'
  | 'moss'
  | 'pole'
  | 'poleHi'
  | 'poleDark'
  | 'lampHead'
  | 'lampLight'
  | 'planter'
  | 'planterDark'
  | 'leafEdge'
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
  ink: '#2f2a3a',
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
  farTop: '#bed4e6',
  farWindow: '#bdd5e8',
  farLit: '#bdd5e8',
  roof: '#5b6172',
  roofHi: '#7d8497',
  antenna: '#4a4f5e',
  beacon: '#d8404f',
  door: '#4a3a34',
  doorKnob: '#e8c46a',
  windowDark: '#4f7898',
  windowSky: '#86b6d8',
  windowShine: '#a9d6f2',
  windowLit: '#6f97b6',
  windowLitTop: '#8fb3cf',
  windowWarm: '#6f97b6',
  windowTv: '#6f97b6',
  awningA: '#e24f5a',
  awningB: '#fff4ea',
  sidewalk: '#cbc5bd',
  sidewalkB: '#c2bcb3',
  sidewalkHi: '#dbd6cf',
  sidewalkJoint: '#b4ada4',
  sidewalkShade: '#aaa39a',
  curb: '#8d8880',
  curbTop: '#e3ded7',
  curbHi: '#f3f0eb',
  curbJoint: '#76716a',
  curbShadow: '#3a2a1a30',
  tileA: '#dad3c9',
  tileB: '#d1c9be',
  tileC: '#e2dcd3',
  tileHi: '#ebe6de',
  grout: '#bfb6aa',
  moss: '#a3b87e',
  pole: '#3e4454',
  poleHi: '#626a7e',
  poleDark: '#2c303c',
  lampHead: '#eef0f2',
  lampLight: '#ffe7a3',
  planter: '#9097a5',
  planterDark: '#6f7583',
  leafEdge: '#1f5a31',
  leafDark: '#2f7d44',
  leaf: '#48a052',
  leafLight: '#74c464',
  trunk: '#6b4a2f',
});

const NIGHT: Palette<CityKey> = parsePalette({
  ink: '#05060c',
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
  farTop: '#252c58',
  farWindow: '#252c5a',
  farLit: '#c9a75a',
  roof: '#1b1d2c',
  roofHi: '#2c2f44',
  antenna: '#2a2d3e',
  beacon: '#ff4d5e',
  door: '#2a2228',
  doorKnob: '#8a7448',
  windowDark: '#181d36',
  windowSky: '#1e2444',
  windowShine: '#232a4a',
  windowLit: '#ffd56e',
  windowLitTop: '#fff0b8',
  windowWarm: '#f2a94e',
  windowTv: '#86b8ff',
  awningA: '#9c3a46',
  awningB: '#6e6470',
  sidewalk: '#383a49',
  sidewalkB: '#333543',
  sidewalkHi: '#454758',
  sidewalkJoint: '#2f3140',
  sidewalkShade: '#2a2c39',
  curb: '#22242f',
  curbTop: '#4a4c5d',
  curbHi: '#5c5e71',
  curbJoint: '#191a23',
  curbShadow: '#00000050',
  tileA: '#2b2e3c',
  tileB: '#282a37',
  tileC: '#2f3242',
  tileHi: '#363a4c',
  grout: '#20222d',
  moss: '#27352f',
  pole: '#242734',
  poleHi: '#363a4b',
  poleDark: '#1a1c26',
  lampHead: '#ffe7a3',
  lampLight: '#ffd27a',
  planter: '#3c3f4e',
  planterDark: '#2b2d3a',
  leafEdge: '#0a1f1a',
  leafDark: '#0f2a24',
  leaf: '#183d31',
  leafLight: '#235441',
  trunk: '#3a2b28',
});

function styles(list: readonly { wall: string; shade: string; trim: string }[]): BuildingStyle[] {
  return list.map((s) => ({
    wall: parseColor(s.wall),
    shade: parseColor(s.shade),
    trim: parseColor(s.trim),
  }));
}

const DAY_BUILDINGS = styles([
  { wall: '#d98f62', shade: '#b8714a', trim: '#f0c9a6' },
  { wall: '#c7d0da', shade: '#a5b0bd', trim: '#e6ebf0' },
  { wall: '#8ea6bd', shade: '#738aa1', trim: '#b9cadb' },
  { wall: '#e4c17b', shade: '#c4a05e', trim: '#f4dfae' },
  { wall: '#b78db2', shade: '#987193', trim: '#d8bcd4' },
  { wall: '#7fb6a3', shade: '#649886', trim: '#b2d8ca' },
]);

const NIGHT_BUILDINGS = styles([
  { wall: '#3d2f3f', shade: '#2e2330', trim: '#4f3e50' },
  { wall: '#2c3550', shade: '#212840', trim: '#3a4566' },
  { wall: '#333a4d', shade: '#262c3c', trim: '#434b62' },
  { wall: '#3b3646', shade: '#2c2836', trim: '#4c4659' },
  { wall: '#2a3a47', shade: '#1f2c37', trim: '#384c5b' },
  { wall: '#352f4f', shade: '#28233d', trim: '#453d63' },
]);

export function cityPalette(theme: SceneTheme): Palette<CityKey> {
  return theme === 'night' ? NIGHT : DAY;
}

/** Discs of a cloud whose left end is at (x, y); shared with the drifting DOM clouds. */
export function cloudDiscs(x: number, y: number, scale = 1): Disc[] {
  return [
    { x: x + 14 * scale, y: y + 14 * scale, r: 10 * scale },
    { x: x + 30 * scale, y: y + 9 * scale, r: 13 * scale },
    { x: x + 48 * scale, y: y + 12 * scale, r: 11 * scale },
    { x: x + 62 * scale, y: y + 16 * scale, r: 8 * scale },
  ];
}

/* ------------------------------------------------------------------ */
/* Painting                                                            */
/* ------------------------------------------------------------------ */

function disc(buf: PixelBuffer, px: number, cx: number, cy: number, r: number, color: Color) {
  ellipseCss(buf, px, cx, cy, r, r, color);
}

/** Dithered light pool: a few flat alpha steps, the pixel-art way to draw a gradient. */
function glow(
  buf: PixelBuffer,
  px: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: Color,
  strength: number,
): void {
  eachPixel(
    buf,
    px,
    { left: cx - rx, top: cy - ry, right: cx + rx, bottom: cy + ry },
    (ax, ay, x, y) => {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      if (d >= 1) return;
      const level = Math.min(3, Math.floor((1 - d) * 3 + bayer(ax, ay)));
      if (level > 0) buf.set(ax, ay, withAlpha(color, level * strength));
    },
  );
}

type WindowLight = 'dark' | 'lit' | 'warm' | 'tv';

function windowLight(night: boolean, r: number): WindowLight {
  if (!night) return 'dark';
  if (r < 0.32) return 'lit';
  if (r < 0.42) return 'warm';
  if (r < 0.47) return 'tv';
  return 'dark';
}

/** One framed window with its sill; `fine` adds glass reflections, blinds and curtains. */
function paintWindow(
  buf: PixelBuffer,
  px: number,
  p: Palette<CityKey>,
  style: BuildingStyle,
  night: boolean,
  wx: number,
  wy: number,
  winW: number,
  seed: number,
): void {
  const light = windowLight(night, hash2(seed, 0, 72));
  const glass = {
    dark: p.windowDark,
    lit: p.windowLit,
    warm: p.windowWarm,
    tv: p.windowTv,
  }[light];
  if (px > 3) {
    rectCss(buf, px, wx, wy, winW, 10, glass);
    if (!night) rectCss(buf, px, wx, wy, px, px, p.windowShine);
    return;
  }
  const u = px;
  const frame = mix(style.shade, p.ink, 0.45);
  const blinds = !night && hash2(seed, 1, 72) < 0.22 ? 1 + Math.floor(hash2(seed, 2, 72) * 3) : 0;
  const curtains = light === 'lit' && hash2(seed, 3, 72) < 0.4;
  rectCss(buf, px, wx - u, wy - u, winW + 2 * u, 10 + 2 * u, frame);
  rectEach(buf, px, wx, wy, winW, 10, (i, j, cols, rows) => {
    if (winW >= 15 && i === Math.floor(cols / 2)) return frame;
    if (j < blinds) return j % 2 === 0 ? style.trim : mix(style.trim, style.shade, 0.35);
    if (light === 'dark') {
      if (!night && j === 0) return p.windowSky;
      const streak = i + j - blinds;
      if (streak === 2 || streak === 3) return p.windowShine;
      return j === rows - 1 ? mix(glass, p.ink, 0.2) : glass;
    }
    if (curtains && (i === 0 || i === cols - 1)) return p.windowWarm;
    if (j === 0) return light === 'lit' ? p.windowLitTop : mix(glass, p.windowLitTop, 0.4);
    return j === rows - 1 ? mix(glass, p.ink, 0.18) : glass;
  });
  // Sill catching the light, and the shadow it casts.
  rectCss(buf, px, wx - 2 * u, wy + 10 + u, winW + 4 * u, u, style.trim);
  rectCss(buf, px, wx - u, wy + 10 + 2 * u, winW + 2 * u, u, mix(style.wall, style.shade, 0.75));
}

function paintBuilding(
  buf: PixelBuffer,
  px: number,
  p: Palette<CityKey>,
  style: BuildingStyle,
  night: boolean,
  x: number,
  top: number,
  w: number,
  base: number,
  id: number,
): void {
  const fine = px <= 3;
  const u = px;
  const h = base - top;
  const line = Math.max(px, 4);
  const outline = mix(style.shade, p.ink, 0.6);
  const texture = hash2(id, 6, 75);
  const shadeCols = Math.max(1, toArt(5, px));

  // Wall: an outlined slab, lit from the left. Small pixels get brick, siding or plaster.
  rectEach(buf, px, x, top, w, h, (i, j, cols) => {
    if (i === 0 || i === cols - 1) return outline;
    if (cols - 1 - i <= shadeCols) return style.shade;
    if (!fine) return style.wall;
    let c = i === 1 ? mix(style.wall, style.trim, 0.55) : style.wall;
    if (texture < 0.34) {
      const course = Math.floor(j / 3);
      const shifted = i + (course % 2) * 4;
      if (j % 3 === 2 || shifted % 8 === 0) c = mix(c, style.trim, 0.38);
      else if (hash2(Math.floor(shifted / 8), course, id) < 0.18) c = mix(c, style.shade, 0.3);
    } else if (texture < 0.67) {
      if (j % 3 === 0) c = mix(c, style.shade, 0.4);
    } else if (hash2(i, j, id + 500) < 0.05) {
      c = mix(c, style.shade, 0.45);
    }
    return c;
  });

  // Cornice: trim band under a roof overhang with a lit top edge; shadow on the wall below.
  const roofH = fine ? 6 : line;
  rectCss(buf, px, x + u, top, w - 2 * u, line, style.trim);
  if (fine) rectCss(buf, px, x + u, top + line, w - 2 * u, u, mix(style.wall, style.shade, 0.8));
  rectEach(buf, px, x - 4, top - roofH, w + 8, roofH, (i, j, cols, rows) => {
    if (!fine) return p.roof;
    if (j === 0 || i === 0 || i === cols - 1 || j === rows - 1) return outline;
    return j === 1 ? p.roofHi : p.roof;
  });

  // Window grid, skipping the ground floor.
  const winW = w >= 70 && hash2(id, 1, 71) < 0.5 ? 15 : 10;
  const stepX = winW + 5 + (w >= 80 ? 5 : 0);
  const cols = Math.max(1, Math.floor((w - 15) / stepX));
  const left = x + Math.floor((w - (cols * stepX - 5)) / 2);
  const groundFloor = base - 25;
  for (let row = 0, wy = top + 15; wy + 10 <= groundFloor; row++, wy += 20) {
    for (let col = 0; col < cols; col++) {
      paintWindow(
        buf,
        px,
        p,
        style,
        night,
        left + col * stepX,
        wy,
        winW,
        id * 64 * 64 + col * 64 + row,
      );
    }
  }

  // Ground floor: a shop with an awning, or a plain door.
  const doorX = x + w / 2 - 5;
  const stripe = fine ? 6 : Math.max(px, 5);
  if (w >= 55 && hash2(id, 2, 73) < 0.55) {
    // Shop window behind the awning.
    const shopGlass = night ? p.windowWarm : p.windowDark;
    if (fine) rectCss(buf, px, x + 8, base - 17, w - 16, 14, outline);
    rectEach(buf, px, x + 10, base - 15, w - 20, 10, (i, j) => {
      if (!fine) return shopGlass;
      if (j === 0) return mix(shopGlass, p.ink, 0.35); // under the awning
      const streak = (i + j) % 11;
      if (!night && (streak === 4 || streak === 5)) return p.windowShine;
      return shopGlass;
    });
    if (!night && !fine) rectCss(buf, px, x + 10, base - 15, 5, px, p.windowShine);
    // Striped awning with a dark top bar and a scalloped edge.
    rectEach(buf, px, x + 4, base - 27, w - 8, 10, (i, j, _cols, rows) => {
      const k = Math.floor((i * px) / stripe) % 2;
      const a = k === 0 ? p.awningA : p.awningB;
      if (!fine) return j * px < 5 ? a : k === 0 ? p.awningB : p.awningA;
      if (j === 0) return mix(p.awningA, p.ink, 0.45);
      if (j === 1) return mix(a, p.awningB, 0.25);
      return j === rows - 1 ? mix(a, p.ink, 0.18) : a;
    });
    if (fine) {
      for (let ax = x + 4, k = 0; ax < x + w - 4 - stripe / 2; ax += stripe, k++) {
        rectCss(buf, px, ax + u, base - 17, stripe - 2 * u, u, k % 2 === 0 ? p.awningA : p.awningB);
      }
    }
    paintDoor(buf, px, p, style, outline, doorX, base, fine);
  } else {
    if (fine) rectCss(buf, px, doorX - 6, base - 22, 22, 4, outline);
    rectCss(buf, px, doorX - 5, base - 21, 20, fine ? 2 : 5, style.trim);
    paintDoor(buf, px, p, style, outline, doorX, base, fine);
  }
  // Plinth.
  if (fine) rectCss(buf, px, x + u, base - u, w - 2 * u, u, mix(style.shade, p.ink, 0.3));

  // Something on the roof.
  const roofKind = hash2(id, 3, 74);
  const roofTop = top - roofH;
  if (roofKind < 0.35) {
    const ax = x + 10 + hash2(id, 4, 74) * Math.max(5, w - 20);
    const ah = 15 + hash2(id, 5, 74) * 15;
    rectCss(buf, px, ax, roofTop - ah, Math.max(px, 3), ah, p.antenna);
    if (fine) rectCss(buf, px, ax - 4, roofTop - ah * 0.6, 10, u, p.antenna);
    rectCss(buf, px, ax - (fine ? px / 2 : 0), roofTop - ah - 5, Math.max(px, 4), 5, p.beacon);
  } else if (roofKind < 0.55 && w >= 50) {
    // Water tank on legs.
    const tx = x + w - 30;
    rectEach(buf, px, tx, roofTop - 20, 20, 13, (i, j, c, r) => {
      if (!fine) return j * px < line ? p.roof : style.shade;
      if (i === 0 || i === c - 1 || j === 0 || j === r - 1) return outline;
      if (j === 1) return p.roofHi;
      if (j % 3 === 0) return mix(style.shade, p.ink, 0.2);
      return i === 1 ? style.trim : style.shade;
    });
    rectCss(buf, px, tx + 2, roofTop - 7, Math.max(px, 3), 7, p.antenna);
    rectCss(buf, px, tx + 15, roofTop - 7, Math.max(px, 3), 7, p.antenna);
  } else if (roofKind < 0.75) {
    // A rooftop box with a vent.
    rectEach(buf, px, x + 5, roofTop - 10, 16, 10, (i, j, c) => {
      if (!fine) return p.planterDark;
      if (i === 0 || i === c - 1 || j === 0) return outline;
      return j === 1 ? p.planter : p.planterDark;
    });
    rectCss(buf, px, x + 9, roofTop - 14, 6, 4, p.antenna);
  }
}

function paintDoor(
  buf: PixelBuffer,
  px: number,
  p: Palette<CityKey>,
  style: BuildingStyle,
  outline: Color,
  doorX: number,
  base: number,
  fine: boolean,
): void {
  const u = px;
  if (!fine) {
    rectCss(buf, px, doorX, base - 15, 10, 15, p.door);
    return;
  }
  rectCss(buf, px, doorX - u, base - 16 - u, 10 + 2 * u, 16 + u, outline);
  rectEach(buf, px, doorX, base - 16, 10, 16, (i, j, cols) => {
    const inset = i >= 1 && i <= cols - 2 && ((j >= 1 && j <= 3) || (j >= 5 && j <= 6));
    return inset ? mix(p.door, p.ink, 0.3) : i === 0 ? mix(p.door, style.trim, 0.25) : p.door;
  });
  rectCss(buf, px, doorX + 7, base - 8, u, u, p.doorKnob);
  rectCss(buf, px, doorX - 2 * u, base - u, 10 + 4 * u, u, style.trim);
}

/** Flat things on the plaza floor, safe to sit under desks: manholes, drains, leaves. */
function paintPlazaDetails(
  buf: PixelBuffer,
  px: number,
  p: Palette<CityKey>,
  night: boolean,
  w: number,
  h: number,
  horizon: number,
): void {
  const fine = px <= 3;
  const rim = mix(p.grout, p.ink, 0.35);
  const metal = mix(p.tileB, p.ink, 0.2);

  // Drain grates along the curb.
  for (let x = 95; x < w - 20; x += 240) {
    rectEach(buf, px, x, horizon + 4, 20, 8, (i, j, c, r) => {
      if (i === 0 || j === 0 || i === c - 1 || j === r - 1) return rim;
      return i % 2 === 0 ? mix(p.ink, p.grout, 0.25) : metal;
    });
  }

  // A few manhole covers, spread out on a coarse lattice.
  const cell = 210;
  for (let gy = 0; horizon + 60 + gy * cell < h - 30; gy++) {
    for (let gx = 0; gx * cell < w; gx++) {
      if (hash2(gx, gy, 92) > 0.55) continue;
      const cx = gx * cell + 40 + hash2(gx, gy, 93) * (cell - 80);
      const cy = horizon + 60 + gy * cell + hash2(gx, gy, 94) * (cell - 80);
      if (cx > w - 20 || cy > h - 20) continue;
      ellipseCss(buf, px, cx, cy, 12, 9, rim);
      ellipseCss(buf, px, cx, cy, 10, 7, metal);
      if (fine) {
        ellipseCss(buf, px, cx - 1, cy - 1, 7, 4.5, mix(metal, p.tileHi, 0.35));
        for (let k = -6; k <= 6; k += 4) rectCss(buf, px, cx + k, cy - 4, px, 8, rim);
        rectCss(buf, px, cx - 7, cy, 14, px, rim);
      }
    }
  }

  // Fallen leaves in the day, puddles of lamplight at night.
  if (!fine) return;
  const area = ((w * (h - horizon)) / 10000) * 2;
  for (let n = 0; n < area; n++) {
    const x = hash2(n, 0, 95) * w;
    const y = horizon + 10 + hash2(n, 1, 95) * (h - horizon - 20);
    if (night) continue;
    const leaf = hash2(n, 2, 95) < 0.5 ? p.leafLight : mix(p.awningA, p.doorKnob, 0.6);
    rectCss(buf, px, x, y, px * 2, px, leaf);
    rectCss(buf, px, x + px, y + px, px, px, mix(leaf, p.ink, 0.25));
  }
}

export function paintCity(buf: PixelBuffer, px: number, theme: SceneTheme): void {
  const night = theme === 'night';
  const fine = px <= 3;
  const u = px;
  const p = cityPalette(theme);
  const looks = night ? NIGHT_BUILDINGS : DAY_BUILDINGS;
  const w = buf.width * px;
  const h = buf.height * px;
  const horizon = cityHorizonPx(h, px);
  const ground = horizon - SIDEWALK_PX;

  // Sky: four bands blended with ordered dithering.
  const bands = [p.sky0, p.sky1, p.sky2, p.sky3] as const;
  eachPixel(buf, px, { left: 0, top: 0, right: w, bottom: ground }, (ax, ay, _x, y) => {
    if (y > ground) return;
    const t = (y / Math.max(1, ground)) * (bands.length - 1);
    const i = Math.min(bands.length - 1, Math.floor(t + bayer(ax, ay) - 0.25));
    buf.set(ax, ay, bands[Math.max(0, i)] ?? p.sky0);
  });

  if (night) {
    // Same star density per CSS area at any pixel size.
    const area = (px * px) / 25;
    eachPixel(buf, px, { left: 0, top: 0, right: w, bottom: ground - 30 }, (ax, ay) => {
      const r = hash2(ax, ay, 81);
      if (r < 0.006 * area) buf.set(ax, ay, p.star);
      else if (r < 0.016 * area) buf.set(ax, ay, p.starDim);
    });
    const mx = w * 0.82;
    disc(buf, px, mx, 30, 17, p.sun);
    disc(buf, px, mx + 8, 26, 14, p.sky0);
  } else {
    const sx = w * 0.84;
    glow(buf, px, sx, 30, 45, 45, p.sunCore, 0.12);
    disc(buf, px, sx, 30, 18, p.sun);
    disc(buf, px, sx - 3, 27, 11, p.sunCore);
  }

  // Far skyline silhouettes with a lit rim and rooftop clutter.
  const dot = Math.max(px, 4);
  for (let i = 0, x = -10; x < w; i++) {
    const bw = 25 + Math.floor(hash2(i, 0, 82) * 40);
    const bh = ground * (0.42 + hash2(i, 1, 82) * 0.33);
    const top = ground - bh;
    rectCss(buf, px, x, top, bw, bh, p.far);
    if (fine) {
      rectCss(buf, px, x, top, bw, u, p.farTop);
      rectCss(buf, px, x, top, u, bh, p.farTop);
      if (hash2(i, 3, 82) < 0.5) rectCss(buf, px, x + bw * 0.6, top - 6, 8, 6, p.far);
    }
    for (let wy = top + 10; wy < ground - 10; wy += 15) {
      for (let wx = x + 5; wx < x + bw - 5; wx += 10) {
        const r = hash2(Math.round(wx), Math.round(wy), 83);
        if (r < 0.12) rectCss(buf, px, wx, wy, dot, dot, p.farLit);
        else if (r < 0.4 && !night) rectCss(buf, px, wx, wy, dot, dot, p.farWindow);
      }
    }
    x += bw + (hash2(i, 2, 82) < 0.3 ? 5 : 0);
  }

  // Near buildings.
  for (let i = 0, x = -Math.floor(hash2(0, 9, 84) * 20); x < w; i++) {
    const bw = 45 + Math.floor(hash2(i, 0, 84) * 50);
    const bh = Math.max(45, (ground - 20) * (0.38 + hash2(i, 1, 84) * 0.55));
    const style = looks[Math.floor(hash2(i, 2, 84) * looks.length)] ?? looks[0];
    if (style !== undefined) paintBuilding(buf, px, p, style, night, x, ground - bh, bw, ground, i);
    x += bw + (hash2(i, 3, 84) < 0.35 ? 5 : 0);
  }

  // Sidewalk slabs, shaded by the buildings at the back, then the curb.
  const SLAB = 35;
  eachPixel(
    buf,
    px,
    { left: 0, top: ground, right: w, bottom: horizon - px / 2 },
    (ax, ay, x, y) => {
      const slab = Math.floor(x / SLAB);
      const lx = x - slab * SLAB;
      let color = hash2(slab, 0, 87) < 0.35 ? p.sidewalkB : p.sidewalk;
      if (y >= horizon - 5) {
        color = lx < px ? p.curbJoint : p.curb;
      } else if (y >= horizon - 10) {
        color = fine && y < horizon - 10 + px ? p.curbHi : p.curbTop;
      } else if (y < ground + 4 || (fine && y < ground + 8 && bayer(ax, ay) < 0.5)) {
        color = p.sidewalkShade;
      } else if (lx < px) {
        color = p.sidewalkJoint;
      } else if (fine && lx < 2 * px) {
        color = p.sidewalkHi;
      } else if (fine && hash2(ax, ay, 88) < 0.04) {
        color = p.sidewalkJoint;
      }
      buf.set(ax, ay, color);
    },
  );

  // Plaza: stone slabs in a straight grid. Neighbouring slabs share weathering (value noise),
  // a lit top edge gives each one depth, and moss creeps into the grout.
  const SLAB_W = 30;
  const SLAB_H = 20;
  const tones = [p.tileC, p.tileA, p.tileA, p.tileB] as const;
  eachPixel(buf, px, { left: 0, top: horizon, right: w, bottom: h }, (ax, ay, x, y) => {
    const ly = y - horizon;
    const row = Math.floor(ly / SLAB_H);
    const col = Math.floor(x / SLAB_W);
    const tx = x - col * SLAB_W;
    const ty = ly - row * SLAB_H;
    if (tx >= SLAB_W - px || ty >= SLAB_H - px) {
      buf.set(ax, ay, !night && fine && hash2(ax, ay, 89) < 0.04 ? p.moss : p.grout);
      return;
    }
    const weather = valueNoise(col / 3.5, row / 3.5, 90) * 0.7 + hash2(col, row, 85) * 0.3;
    let color = tones[Math.min(tones.length - 1, Math.floor(weather * tones.length))] ?? p.tileA;
    if (fine) {
      if (ty < px) color = p.tileHi;
      else if (hash2(ax, ay, 86) < 0.025) color = p.tileB;
      else if (hash2(ax, ay, 87) < 0.012) color = p.tileHi;
      // The odd cracked slab.
      if (hash2(col, row, 91) > 0.965 && Math.abs(tx - ty * 1.2 - 6) < px * 0.6) color = p.grout;
    }
    buf.set(ax, ay, color);
  });
  paintPlazaDetails(buf, px, p, night, w, h, horizon);

  // Curb shadow falling on the plaza.
  rectCss(buf, px, 0, horizon, w, px, p.curbShadow);
  // Lamplight spilling onto the plaza at night.
  if (night && fine) {
    for (let x = 30; x < w; x += 120) glow(buf, px, x + 3, horizon + 4, 40, 18, p.lampLight, 0.05);
  }

  // Street lamps and little trees in planters along the sidewalk.
  const poleW = fine ? 3 * px : Math.max(px, 4);
  for (let x = 30; x < w; x += 120) {
    const top = horizon - 75;
    if (night) glow(buf, px, x + poleW / 2, top + 5, 20, 20, p.lampLight, 0.1);
    rectCss(buf, px, x, top + 10, poleW, 65, p.pole);
    if (fine) {
      rectCss(buf, px, x, top + 10, u, 65, p.poleHi);
      rectCss(buf, px, x + poleW - u, top + 10, u, 65, p.poleDark);
      // Stepped base.
      rectCss(buf, px, x - 2 * u, horizon - 16, poleW + 4 * u, 6, p.pole);
      rectCss(buf, px, x - 2 * u, horizon - 16, poleW + 4 * u, u, p.poleHi);
      rectCss(buf, px, x - 4 * u, horizon - 10, poleW + 8 * u, 5, p.poleDark);
      rectCss(buf, px, x - 4 * u, horizon - 10, poleW + 8 * u, u, p.pole);
      // Lantern: finial, cap, glass with a center bar, bottom ring.
      rectCss(buf, px, x + u, top - 9, u, 3, p.poleDark);
      rectCss(buf, px, x - 3 * u, top - 6, poleW + 6 * u, 2 * u, p.poleDark);
      rectCss(buf, px, x - 2 * u, top - 2, poleW + 4 * u, 10, p.lampHead);
      rectCss(buf, px, x - 2 * u, top - 2, u, 10, p.poleDark);
      rectCss(buf, px, x + poleW + u, top - 2, u, 10, p.poleDark);
      rectCss(buf, px, x + u, top - 2, u, 10, p.poleDark);
      rectCss(buf, px, x - 3 * u, top + 8, poleW + 6 * u, u, p.poleDark);
    } else {
      rectCss(buf, px, x - 5, horizon - 10, poleW + 10, 5, p.poleDark);
      rectCss(buf, px, x - 5, top, poleW + 10, 10, p.lampHead);
      rectCss(buf, px, x - 5, top - 5, poleW + 10, 5, p.poleDark);
    }

    const tx = x + 60;
    if (tx - 20 > w) continue;
    rectEach(buf, px, tx - 17, horizon - 20, 35, 10, (i, j, c, r) => {
      if (!fine) return j * px < 5 ? p.planter : p.planterDark;
      if (i === 0 || i === c - 1 || j === r - 1) return mix(p.planterDark, p.ink, 0.4);
      if (j === 0) return mix(p.planter, p.curbHi, 0.5);
      if (j === 1) return mix(p.trunk, p.ink, 0.3);
      return j < r / 2 ? p.planter : p.planterDark;
    });
    rectCss(buf, px, tx - poleW / 2, horizon - 32, poleW, 12, p.trunk);
    blob(
      buf,
      px,
      [
        { x: tx, y: horizon - 42, r: 15 },
        { x: tx - 10, y: horizon - 36, r: 10 },
        { x: tx + 10, y: horizon - 37, r: 10 },
      ],
      { edge: p.leafEdge, dark: p.leafDark, mid: p.leaf, light: p.leafLight, hi: p.leafLight },
      { salt: x, texture: fine ? 0.4 : 0.15 },
    );
  }
}
