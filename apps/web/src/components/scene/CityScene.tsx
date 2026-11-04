import { memo, useCallback, useMemo } from 'react';
import { seededRandom } from '../../lib/seed';
import { SIDEWALK_ROWS, cityHorizonArt, paintCity } from './city';
import { PixelCanvas, artSize } from './PixelCanvas';
import type { PixelBuffer } from './pixels';
import { PIXEL } from './pixels';
import styles from './Scene.module.css';
import { SpriteSvg } from './SpriteSvg';
import type { CSSVars } from './SpriteSvg';
import type { SceneTheme } from './useSceneTheme';

const CLOUD = [
  [
    '......wwww......',
    '...wwwwwwwww....',
    '..wwwwwwwwwwwww.',
    '.wwwwwwwwwwwwwww',
    '.sssssssssssss..',
  ],
];
const CLOUD_COLORS = {
  day: { w: '#ffffff', s: '#d3ebf8' },
  night: { w: '#2b3164', s: '#222857' },
} as const;
const CLOUD_WIDTH = 16 * PIXEL;
/** Cloud drift speed in px per second. */
const CLOUD_SPEED = 7;

interface SceneProps {
  /** Zone size in CSS px. */
  readonly width: number;
  readonly height: number;
  readonly theme: SceneTheme;
}

/** The meeting zone as a pixel-art downtown: skyline, sidewalk, and a paved plaza. */
function CitySceneImpl({ width, height, theme }: SceneProps) {
  const w = artSize(width);
  const h = artSize(height);
  const paint = useCallback(
    (buf: PixelBuffer) => {
      paintCity(buf, theme);
    },
    [theme],
  );
  const ground = cityHorizonArt(h) - SIDEWALK_ROWS;

  const travel = width + CLOUD_WIDTH * 2;
  const duration = travel / CLOUD_SPEED;
  const clouds = [
    { row: 3, phase: 0.15 },
    { row: Math.min(10, ground - 8), phase: 0.65 },
  ];

  const stars = useMemo(() => {
    const rand = seededRandom(0x57a75);
    return Array.from({ length: 7 }, () => ({
      left: Math.floor(rand() * w) * PIXEL,
      top: Math.floor(1 + rand() * Math.max(1, ground - 9)) * PIXEL,
      delay: `${(-rand() * 3).toFixed(2)}s`,
    }));
  }, [w, ground]);

  return (
    <div className={styles.scene} aria-hidden>
      <PixelCanvas width={w} height={h} paint={paint} />
      {clouds.map((c, i) => (
        <SpriteSvg
          key={i}
          className={styles.cloud}
          frames={CLOUD}
          colors={CLOUD_COLORS[theme]}
          style={{
            top: c.row * PIXEL,
            animationTimingFunction: `steps(${Math.round(travel / PIXEL)}, end)`,
            '--travel': `${travel}px`,
            '--dur': `${duration.toFixed(0)}s`,
            '--delay': `${(-duration * c.phase).toFixed(0)}s`,
          }}
        />
      ))}
      {theme === 'night' &&
        stars.map((s, i) => (
          <span
            key={i}
            className={styles.twinkle}
            style={{ left: s.left, top: s.top, '--delay': s.delay } as CSSVars}
          />
        ))}
    </div>
  );
}

export const CityScene = memo(CitySceneImpl);
