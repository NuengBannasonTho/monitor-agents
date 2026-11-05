import { memo, useCallback, useMemo } from 'react';
import { seededRandom } from '../../lib/seed';
import { forestLandmarks, paintForest } from './forest';
import { PixelCanvas, artSize } from './PixelCanvas';
import type { PixelBuffer } from './pixels';
import { valueNoise } from './pixels';
import styles from './Scene.module.css';
import { SpriteSvg } from './SpriteSvg';
import type { CSSVars } from './SpriteSvg';
import type { SceneTheme } from './useSceneTheme';

/** Hand-drawn flames for big pixels. */
const COARSE_FLAMES = [
  ['...r...', '..rr...', '..ror..', '.rooor.', '.royor.', 'rooyyor', 'royyyor', '.ryyyr.'],
  ['....r..', '...rr..', '..roor.', '.rooor.', '.royyor', 'rooyyor', 'royyyyr', '.ryyyr.'],
  ['..r....', '..rr...', '.rorr..', '.roor..', '.royor.', 'rooyoor', 'royyyor', '.ryyyr.'],
];
const FLAME_COLORS = { r: '#e2452e', o: '#ff9a2e', y: '#ffd34a', w: '#fff6c8' };
/** Flame box in CSS px. */
const FLAME_W = 36;
const FLAME_H = 42;

/**
 * Flames for small pixels: a heat field that narrows toward the top, stirred by noise that
 * scrolls upward from frame to frame, then cut into four color bands.
 */
function fineFlames(px: number): string[][] {
  const cols = Math.round(FLAME_W / px);
  const rows = Math.round(FLAME_H / px);
  return [0, 1, 2].map((frame) =>
    Array.from({ length: rows }, (_, y) => {
      let row = '';
      for (let x = 0; x < cols; x++) {
        const u = ((x + 0.5) / cols) * 2 - 1;
        const v = 1 - (y + 0.5) / rows;
        const halfWidth = Math.max(0.05, (1 - v ** 1.3) * 0.95);
        const body = 1 - Math.abs(u) / halfWidth;
        const n = valueNoise(x * 0.45, (y + frame * 4.5) * 0.4, 7 + frame);
        const heat = body * 1.15 - v * 0.45 + (n - 0.5) * 0.75;
        row += heat > 0.95 ? 'w' : heat > 0.68 ? 'y' : heat > 0.42 ? 'o' : heat > 0.18 ? 'r' : '.';
      }
      return row;
    }),
  );
}

const COARSE_BUTTERFLY = [
  ['ww.ww', 'wwbww', '.w.w.'],
  ['.....', '.wbw.', '.w.w.'],
];
const FINE_BUTTERFLY = [
  ['ww.b.ww', 'wdwbwdw', '.wwbww.', '.ww.ww.'],
  ['...b...', '..wbw..', '..wbw..', '..w.w..'],
];
const BUTTERFLY_WINGS = ['#ffffff', '#ffd94a', '#ff9ec7'] as const;

interface Floater {
  readonly left: string;
  readonly top: string;
  readonly style: CSSVars;
}

function floaters(
  count: number,
  seed: number,
  area: { x0: number; x1: number; y0: number; y1: number },
) {
  const rand = seededRandom(seed);
  return Array.from({ length: count }, (): Floater => {
    const left = area.x0 + rand() * (area.x1 - area.x0);
    const top = area.y0 + rand() * (area.y1 - area.y0);
    return {
      left: `${(left * 100).toFixed(1)}%`,
      top: `${(top * 100).toFixed(1)}%`,
      style: {
        '--dx': `${Math.round((rand() - 0.5) * 16) * 5}px`,
        '--dy': `${Math.round((rand() - 0.5) * 10) * 5}px`,
        '--dur': `${(5 + rand() * 6).toFixed(1)}s`,
        '--delay': `${(-rand() * 10).toFixed(1)}s`,
      },
    };
  });
}

const FIREFLIES = floaters(12, 0xf1ef1e5, { x0: 0.08, x1: 0.92, y0: 0.18, y1: 0.9 });
const BUTTERFLIES = floaters(3, 0xb077e7, { x0: 0.15, x1: 0.8, y0: 0.3, y1: 0.75 });

interface SceneProps {
  /** Zone size in CSS px. */
  readonly width: number;
  readonly height: number;
  readonly theme: SceneTheme;
  /** CSS px per art pixel, matching the avatars on screen. */
  readonly px: number;
}

/** The lounge as a pixel-art forest glade: campfire, pond, trail, and wildlife. */
function ForestSceneImpl({ width, height, theme, px }: SceneProps) {
  const w = artSize(width, px);
  const h = artSize(height, px);
  const fine = px <= 3;
  const paint = useCallback(
    (buf: PixelBuffer) => {
      paintForest(buf, px, theme);
    },
    [px, theme],
  );
  const camp = useMemo(() => forestLandmarks(w * px, h * px).camp, [w, h, px]);
  const flames = useMemo(() => (fine ? fineFlames(px) : COARSE_FLAMES), [fine, px]);
  const flameCols = flames[0]?.[0]?.length ?? 0;
  const flameRows = flames[0]?.length ?? 0;
  const mote = fine ? px * 2 : px;

  return (
    <div className={styles.scene} aria-hidden>
      <PixelCanvas width={w} height={h} px={px} paint={paint} />
      <div
        className={styles.fire}
        style={{
          left: Math.round((camp.x - (flameCols * px) / 2) / px) * px,
          top: Math.round((camp.y - flameRows * px + px) / px) * px,
          width: flameCols * px,
          height: flameRows * px,
        }}
      >
        <SpriteSvg className={styles.flame} frames={flames} colors={FLAME_COLORS} cell={px} />
        {[0.3, 0.6].map((at, i) => (
          <span
            key={at}
            className={styles.spark}
            style={
              {
                left: Math.round((flameCols * at) / 1) * px,
                width: mote,
                height: mote,
                '--delay': `${-0.8 * i}s`,
              } as CSSVars
            }
          />
        ))}
      </div>
      {theme === 'night'
        ? FIREFLIES.map((f, i) => (
            <span
              key={i}
              className={styles.firefly}
              style={{ ...f.style, left: f.left, top: f.top, width: mote, height: mote }}
            />
          ))
        : BUTTERFLIES.map((f, i) => (
            <SpriteSvg
              key={i}
              className={styles.butterfly}
              style={{ ...f.style, left: f.left, top: f.top }}
              frames={fine ? FINE_BUTTERFLY : COARSE_BUTTERFLY}
              frameClassNames={[styles.frameA, styles.frameB]}
              cell={px}
              colors={{
                w: BUTTERFLY_WINGS[i % BUTTERFLY_WINGS.length] ?? '#ffffff',
                b: '#3b2a20',
                d: '#3b2a20',
              }}
            />
          ))}
    </div>
  );
}

export const ForestScene = memo(ForestSceneImpl);
