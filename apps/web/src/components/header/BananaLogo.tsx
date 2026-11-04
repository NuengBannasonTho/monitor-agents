import { rowsToRuns } from '../worker/sprite';
import styles from './BananaLogo.module.css';

/**
 * The app mark: an original pixel-art banana, 16 x 22 cells. index.html uses the same
 * art as its favicon, so keep the two in sync when changing it.
 *
 * Keys: K outline · Y peel · y peel shade · L highlight · G/g stem · B tip
 *       E eye · W eye shine · M mouth · R blush
 */
export const BANANA_ROWS: readonly string[] = [
  '...........KK...',
  '..........KGK...',
  '.........KgK....',
  '........KKK.....',
  '......KKYyyK....',
  '.....KLYYYyyK...',
  '....KLYYYYyyK...',
  '...KLYYYYYyyK...',
  '...KLYYYYyyK....',
  '..KLYYYYYyyK....',
  '..KLEWYYEWyK....',
  '..KLEEYYEEyK....',
  '..KRYYYYYyRK....',
  '..KLYMYYMyyK....',
  '..KLYYMMYyyK....',
  '...KLYYYYYyyK...',
  '...KLYYYYYyyK...',
  '....KYYYYYYyyK..',
  '.....KKYYYYyyK..',
  '.......KKYYyyK..',
  '.........KKKKK..',
  '............BK..',
];

export const BANANA_COLORS: Readonly<Record<string, string>> = {
  K: '#3b2a14',
  Y: '#ffd93b',
  y: '#e8a91c',
  L: '#fff2a1',
  G: '#7fb93b',
  g: '#5a8f2a',
  B: '#6b4a24',
  E: '#3b2a14',
  W: '#ffffff',
  M: '#8a3a1e',
  R: '#ff9a8a',
};

const COLS = 16;
const ROWS = BANANA_ROWS.length;
const RUNS = rowsToRuns(BANANA_ROWS);
/** Painting the top eye row in peel color leaves a closed-eye line. */
const LIDS: readonly (readonly [number, string])[] = [
  [4, 'Y'],
  [5, 'Y'],
  [8, 'Y'],
  [9, 'Y'],
];

interface BananaLogoProps {
  /** CSS px per sprite cell; integers keep every pixel square. */
  readonly cell?: number;
}

export function BananaLogo({ cell = 2 }: BananaLogoProps) {
  return (
    <svg
      className={styles.logo}
      width={COLS * cell}
      height={ROWS * cell}
      viewBox={`0 0 ${COLS} ${ROWS}`}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {RUNS.map((r) => (
        <rect
          key={`${r.x},${r.y}`}
          x={r.x}
          y={r.y}
          width={r.w}
          height={1}
          fill={BANANA_COLORS[r.key]}
        />
      ))}
      <g className={styles.lids}>
        {LIDS.map(([x, key]) => (
          <rect key={x} x={x} y={10} width={1} height={1} fill={BANANA_COLORS[key]} />
        ))}
      </g>
    </svg>
  );
}
