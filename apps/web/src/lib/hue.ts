import { unitFromString } from './seed';

/**
 * Hue window for agents: crimson (~338°) through pinkish red to pure red (~4°).
 * Wraps around 360 so every value stays in the red/pink/crimson family.
 */
const HUE_START = 336;
const HUE_SPAN = 30;

export function hueForSession(sessionId: string): number {
  const h = HUE_START + unitFromString(sessionId, 'hue') * HUE_SPAN;
  return Math.round(h % 360);
}

export interface BlobPalette {
  readonly light: string;
  readonly base: string;
  readonly dark: string;
  readonly rim: string;
}

export function paletteForHue(hue: number): BlobPalette {
  return {
    light: `hsl(${hue} 92% 72%)`,
    base: `hsl(${hue} 78% 52%)`,
    dark: `hsl(${hue} 72% 34%)`,
    rim: `hsl(${hue} 70% 26%)`,
  };
}
