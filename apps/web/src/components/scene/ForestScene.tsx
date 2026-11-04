import { memo, useCallback, useMemo } from 'react';
import { seededRandom } from '../../lib/seed';
import { forestLandmarks, paintForest } from './forest';
import { PixelCanvas, artSize } from './PixelCanvas';
import type { PixelBuffer } from './pixels';
import { PIXEL } from './pixels';
import styles from './Scene.module.css';
import { SpriteSvg } from './SpriteSvg';
import type { CSSVars } from './SpriteSvg';
import type { SceneTheme } from './useSceneTheme';

const FLAMES = [
  ['...r...', '..rr...', '..ror..', '.rooor.', '.royor.', 'rooyyor', 'royyyor', '.ryyyr.'],
  ['....r..', '...rr..', '..roor.', '.rooor.', '.royyor', 'rooyyor', 'royyyyr', '.ryyyr.'],
  ['..r....', '..rr...', '.rorr..', '.roor..', '.royor.', 'rooyoor', 'royyyor', '.ryyyr.'],
];
const FLAME_COLORS = { r: '#e2452e', o: '#ff9a2e', y: '#ffd34a' };

const BUTTERFLY = [
  ['ww.ww', 'wwbww', '.w.w.'],
  ['.....', '.wbw.', '.w.w.'],
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
        '--dx': `${Math.round((rand() - 0.5) * 16) * PIXEL}px`,
        '--dy': `${Math.round((rand() - 0.5) * 10) * PIXEL}px`,
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
}

/** The lounge as a pixel-art forest glade: campfire, pond, trail, and wildlife. */
function ForestSceneImpl({ width, height, theme }: SceneProps) {
  const w = artSize(width);
  const h = artSize(height);
  const paint = useCallback(
    (buf: PixelBuffer) => {
      paintForest(buf, theme);
    },
    [theme],
  );
  const camp = useMemo(() => forestLandmarks(w, h).camp, [w, h]);

  return (
    <div className={styles.scene} aria-hidden>
      <PixelCanvas width={w} height={h} paint={paint} />
      <div
        className={styles.fire}
        style={{ left: (camp.x - 3) * PIXEL, top: (camp.y - 8) * PIXEL }}
      >
        <SpriteSvg className={styles.flame} frames={FLAMES} colors={FLAME_COLORS} />
        <span className={styles.spark} style={{ left: 2 * PIXEL, '--delay': '0s' } as CSSVars} />
        <span className={styles.spark} style={{ left: 4 * PIXEL, '--delay': '-0.8s' } as CSSVars} />
      </div>
      {theme === 'night'
        ? FIREFLIES.map((f, i) => (
            <span
              key={i}
              className={styles.firefly}
              style={{ ...f.style, left: f.left, top: f.top }}
            />
          ))
        : BUTTERFLIES.map((f, i) => (
            <SpriteSvg
              key={i}
              className={styles.butterfly}
              style={{ ...f.style, left: f.left, top: f.top }}
              frames={BUTTERFLY}
              frameClassNames={[styles.frameA, styles.frameB]}
              colors={{ w: BUTTERFLY_WINGS[i % BUTTERFLY_WINGS.length] ?? '#ffffff', b: '#3b2a20' }}
            />
          ))}
    </div>
  );
}

export const ForestScene = memo(ForestSceneImpl);
