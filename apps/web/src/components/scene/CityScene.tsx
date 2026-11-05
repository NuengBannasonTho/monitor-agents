import { memo, useCallback, useMemo } from 'react';
import { seededRandom } from '../../lib/seed';
import { SIDEWALK_PX, cityHorizonPx, cloudDiscs, paintCity } from './city';
import { PixelCanvas, artSize } from './PixelCanvas';
import type { PixelBuffer } from './pixels';
import styles from './Scene.module.css';
import { SpriteSvg } from './SpriteSvg';
import type { SceneTheme } from './useSceneTheme';

const CLOUD_COLORS = {
  day: { w: '#ffffff', s: '#d3ebf8' },
  night: { w: '#2b3164', s: '#222857' },
} as const;
/** Cloud box in CSS px. */
const CLOUD_W = 76;
const CLOUD_H = 30;
/** Cloud drift speed in px per second. */
const CLOUD_SPEED = 7;

/** A cloud as sprite rows at this pixel size: flat white with a shaded underside. */
function cloudRows(px: number): string[] {
  const cols = Math.round(CLOUD_W / px);
  const rows = Math.round(CLOUD_H / px);
  const discs = cloudDiscs(0, 0);
  const inside = (x: number, y: number) =>
    discs.some((d) => (x - d.x) ** 2 + (y - d.y) ** 2 <= d.r * d.r) && y <= 24;
  return Array.from({ length: rows }, (_, r) => {
    let row = '';
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * px;
      const y = (r + 0.5) * px;
      if (!inside(x, y)) row += '.';
      else row += inside(x, y + Math.max(px, 5)) ? 'w' : 's';
    }
    return row;
  });
}

interface SceneProps {
  /** Zone size in CSS px. */
  readonly width: number;
  readonly height: number;
  readonly theme: SceneTheme;
  /** CSS px per art pixel, matching the avatars on screen. */
  readonly px: number;
}

/** The meeting zone as a pixel-art downtown: skyline, sidewalk, and a paved plaza. */
function CitySceneImpl({ width, height, theme, px }: SceneProps) {
  const w = artSize(width, px);
  const h = artSize(height, px);
  const paint = useCallback(
    (buf: PixelBuffer) => {
      paintCity(buf, px, theme);
    },
    [px, theme],
  );
  const ground = cityHorizonPx(h * px, px) - SIDEWALK_PX;
  const cloud = useMemo(() => [cloudRows(px)], [px]);

  const travel = width + CLOUD_W * 2;
  const duration = travel / CLOUD_SPEED;
  const clouds = [
    { top: 15, phase: 0.15 },
    { top: Math.min(50, ground - 40), phase: 0.65 },
  ];

  const stars = useMemo(() => {
    const rand = seededRandom(0x57a75);
    return Array.from({ length: 7 }, () => ({
      left: Math.floor(rand() * w) * px,
      top: Math.floor((5 + rand() * Math.max(5, ground - 45)) / px) * px,
      delay: `${(-rand() * 3).toFixed(2)}s`,
    }));
  }, [w, px, ground]);

  return (
    <div className={styles.scene} aria-hidden>
      <PixelCanvas width={w} height={h} px={px} paint={paint} />
      {clouds.map((c, i) => (
        <SpriteSvg
          key={i}
          className={styles.cloud}
          frames={cloud}
          colors={CLOUD_COLORS[theme]}
          cell={px}
          style={{
            top: Math.round(c.top / px) * px,
            animationTimingFunction: `steps(${Math.round(travel / px)}, end)`,
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
            style={{
              left: s.left,
              top: s.top,
              width: px,
              height: px,
              animationDelay: s.delay,
            }}
          />
        ))}
    </div>
  );
}

export const CityScene = memo(CitySceneImpl);
