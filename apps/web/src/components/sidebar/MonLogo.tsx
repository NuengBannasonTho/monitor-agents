import { MARK } from '../../lib/brand';
import styles from './MonLogo.module.css';

interface MonLogoProps {
  /** Width and height in CSS px. */
  readonly size?: number;
}

/** The app mark: a mangosteen from above on a dark rounded tile (see lib/brand). */
export function MonLogo({ size = 32 }: MonLogoProps) {
  return (
    <svg className={styles.logo} width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx={MARK.radius} fill={MARK.tile} />
      <path fill={MARK.flesh} d={MARK.segments} />
      <path fill={MARK.leafColor} d={MARK.leaf} />
    </svg>
  );
}
