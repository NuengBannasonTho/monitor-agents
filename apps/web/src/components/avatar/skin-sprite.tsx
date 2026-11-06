import type { CSSProperties } from 'react';
import { unitFromString } from '../../lib/seed';
import { SKIN_FRAME_MS } from '../../skins/skin-motion';
import { useSkinSheet } from '../../skins/use-skin-sheet';
import styles from './avatar.module.css';

interface SkinSpriteProps {
  readonly src: string;
  /** Rendered size in CSS px (an integer multiple of the image size). */
  readonly px: number;
  /** Offsets the loop per agent, so a crowd of the same costume doesn't move in lockstep. */
  readonly seed: string;
  readonly title?: string;
}

type SpriteVars = CSSProperties & Readonly<Record<'--skin-delay', string>>;

/** A skin image that comes alive once its animation strip is ready. */
export function SkinSprite({ src, px, seed, title }: SkinSpriteProps): React.JSX.Element {
  const sheet = useSkinSheet(src);
  const style: SpriteVars = {
    width: px,
    height: px,
    '--skin-delay': `${(-unitFromString(seed, 'breathe') * 1.3).toFixed(2)}s`,
  };

  return (
    <span
      className={styles.sprite}
      style={style}
      role={title === undefined ? undefined : 'img'}
      aria-label={title}
      aria-hidden={title === undefined ? true : undefined}
    >
      {sheet === null ? (
        <img
          className={styles.still}
          src={src}
          width={px}
          height={px}
          alt=""
          draggable={false}
          decoding="async"
        />
      ) : (
        <span
          className={styles.sheet}
          style={{
            backgroundImage: `url("${sheet.url}")`,
            backgroundSize: `${sheet.frames * px}px ${px}px`,
            animationDuration: `${sheet.frames * SKIN_FRAME_MS}ms`,
            animationTimingFunction: `steps(${sheet.frames}, jump-none)`,
            animationDelay: `${-Math.floor(unitFromString(seed, 'frames') * sheet.frames) * SKIN_FRAME_MS}ms`,
          }}
        />
      )}
    </span>
  );
}
