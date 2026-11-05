import type { AgentState } from '@agent-office/shared';
import { memo } from 'react';
import { cx } from '../../lib/cx';
import { useSkins } from '../../skins/SkinContext';
import type { SkinState } from '../../skins/SkinContext';
import { workerPalette } from '../worker/palette';
import { PixelWorker } from '../worker/PixelWorker';
import type { Cell } from '../worker/sprite';
import {
  ALERT,
  DOC_BADGE,
  SPRITE_COLS,
  TERMINAL,
  TERMINAL_CURSOR,
  TYPING_BADGE,
  ZZZ,
} from '../worker/sprite';
import styles from './Avatar.module.css';
import { SkinSprite } from './SkinSprite';

export type AvatarVariant = 'office' | 'hero' | 'thumb';

/** Layout box per variant. Pixel workers fill it; image skins sit bottom-aligned inside it. */
export const AVATAR_BOX: Readonly<Record<AvatarVariant, { width: number; height: number }>> = {
  office: { width: 96, height: 140 },
  hero: { width: 132, height: 196 },
  thumb: { width: 56, height: 72 },
};
const PIXEL_WIDTH: Readonly<Record<AvatarVariant, number>> = { office: 90, hero: 126, thumb: 36 };
/** Integer upscale of the skin grid, so every sprite pixel stays square. */
const SKIN_SCALE: Readonly<Record<AvatarVariant, number>> = { office: 2, hero: 2, thumb: 1 };

/**
 * CSS px per sprite pixel of the office avatars currently shown: 5 for pixel workers,
 * 2 for image skins. Scenery uses the same size so the two never look out of scale.
 */
export function officePixelSize(skins: Pick<SkinState, 'pack' | 'mode'>): number {
  return skins.pack === null || skins.mode === 'pixel'
    ? PIXEL_WIDTH.office / SPRITE_COLS
    : SKIN_SCALE.office;
}

interface AvatarProps {
  readonly state: AgentState;
  readonly desk: string;
  readonly hue: number;
  readonly seed: string;
  readonly variant: AvatarVariant;
  readonly title?: string;
  /** Force a specific skin image (costume picker thumbnails). */
  readonly imageKey?: string;
}

const BADGE_PALETTE = workerPalette(0, 'badge');

function badgeCells(
  state: AgentState,
  mode: 'by-state' | 'by-agent',
): {
  cells: readonly Cell[];
  blink?: readonly Cell[];
} | null {
  // By-state images already show the process; only the urgent state gets a badge.
  if (mode === 'by-state') return state === 'needs-you' ? { cells: ALERT } : null;
  switch (state) {
    case 'needs-you':
      return { cells: ALERT };
    case 'running':
      return { cells: TERMINAL, blink: TERMINAL_CURSOR };
    case 'reading':
      return { cells: DOC_BADGE };
    case 'working':
      return { cells: TYPING_BADGE };
    case 'stale':
      return { cells: ZZZ };
    default:
      return null;
  }
}

function Cells({ cells }: { cells: readonly Cell[] }) {
  return (
    <>
      {cells.map(([x, y, key]) => (
        <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill={BADGE_PALETTE[key]} />
      ))}
    </>
  );
}

function AvatarImpl({ state, desk, hue, seed, variant, title, imageKey }: AvatarProps) {
  const skins = useSkins();
  const box = AVATAR_BOX[variant];
  const src = imageKey !== undefined ? skins.spriteUrl(imageKey) : skins.spriteFor(state, desk);

  if (src === null || skins.pack === null || skins.mode === 'pixel') {
    return (
      <div className={styles.box} style={box} data-skin="pixel">
        <PixelWorker
          state={state}
          hue={hue}
          size={PIXEL_WIDTH[variant]}
          seed={seed}
          {...(title === undefined ? {} : { title })}
        />
      </div>
    );
  }

  const px = skins.pack.manifest.size * SKIN_SCALE[variant];
  const badge = imageKey === undefined ? badgeCells(state, skins.mode) : null;
  const badgeWidth = Math.round(px * 0.62);

  return (
    <div
      className={cx(styles.box, styles.skin, styles[`state-${state}`])}
      style={box}
      data-skin={skins.mode}
      data-state={state}
    >
      <SkinSprite src={src} px={px} seed={seed} {...(title === undefined ? {} : { title })} />
      {badge !== null && (
        <svg
          className={styles.badge}
          width={badgeWidth}
          height={(badgeWidth * 6) / SPRITE_COLS}
          viewBox={`0 -6 ${SPRITE_COLS} 6`}
          shapeRendering="crispEdges"
          aria-hidden
        >
          <Cells cells={badge.cells} />
          {badge.blink !== undefined && (
            <g className={styles.blink}>
              <Cells cells={badge.blink} />
            </g>
          )}
        </svg>
      )}
    </div>
  );
}

export const Avatar = memo(AvatarImpl);
