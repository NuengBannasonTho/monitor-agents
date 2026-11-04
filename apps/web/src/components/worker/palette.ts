import { unitFromString } from '../../lib/seed';

interface Tone {
  readonly base: string;
  readonly accent: string;
}

/** Hair: base + highlight. */
const HAIR: readonly Tone[] = [
  { base: '#3b2a22', accent: '#5e4232' },
  { base: '#1f1b22', accent: '#3a3442' },
  { base: '#6b3a22', accent: '#93542f' },
  { base: '#8a6030', accent: '#b5843f' },
  { base: '#2e2a4a', accent: '#4a4470' },
];

/** Skin: base + shadow. */
const SKIN: readonly Tone[] = [
  { base: '#f7d6b5', accent: '#e2b48f' },
  { base: '#ecbb93', accent: '#d39c74' },
  { base: '#cf956a', accent: '#b27a52' },
  { base: '#9a6644', accent: '#7f5236' },
];

function pick<T>(list: readonly T[], seed: string, salt: string): T {
  const item = list[Math.floor(unitFromString(seed, salt) * list.length)];
  if (item === undefined) throw new Error('empty palette list');
  return item;
}

export type PaletteMap = Readonly<Record<string, string>>;

/**
 * Colors for one worker. The shirt carries the agent's hue (red/pink/crimson
 * family); hair and skin vary per session so a busy office is easy to tell apart.
 */
export function workerPalette(hue: number, seed: string): PaletteMap {
  const hair = pick(HAIR, seed, 'hair');
  const skin = pick(SKIN, seed, 'skin');
  return {
    K: '#2a1c18',
    H: hair.base,
    h: hair.accent,
    b: hair.base,
    S: skin.base,
    s: skin.accent,
    C: `hsl(${hue} 72% 52%)`,
    c: `hsl(${hue} 66% 38%)`,
    L: `hsl(${hue} 85% 68%)`,
    Y: '#2f3b63',
    B: '#f4f1ea',
    P: '#3d4258',
    F: '#231a18',
    E: '#2a1c18',
    W: '#ffffff',
    M: '#7a2a2e',
    m: '#d4545d',
    R: '#f08f96',
    D: '#7cc7f0',
    d: '#14151c',
    G: '#7cf0a6',
    r: '#ff2b45',
    z: '#8d8aa0',
    g: '#a9a6b8',
  };
}
