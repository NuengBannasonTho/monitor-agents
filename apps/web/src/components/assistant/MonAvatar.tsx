import type { CustomAgentColor } from '@agent-office/shared';
import { MARK } from '../../lib/brand';
import { COLOR_HEX } from '../customAgents/colors';
import styles from './MonAvatar.module.css';

interface MonAvatarProps {
  readonly color: CustomAgentColor;
  readonly size?: number;
  /** Thinking: it breathes gently (still with reduced motion). */
  readonly busy?: boolean;
}

/** MON MANG's face: the app's mangosteen on a tile in the color you picked for it. */
export function MonAvatar({ color, size = 32, busy = false }: MonAvatarProps) {
  return (
    <svg
      className={styles.avatar}
      data-busy={busy || undefined}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
    >
      <rect width="64" height="64" rx={MARK.radius} fill={COLOR_HEX[color]} />
      <path fill={MARK.flesh} d={MARK.segments} />
      <path fill={MARK.flesh} fillOpacity={0.7} d={MARK.leaf} />
    </svg>
  );
}
