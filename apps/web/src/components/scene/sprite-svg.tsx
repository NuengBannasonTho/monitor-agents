import type { CSSProperties } from 'react';
import { rowsToRuns } from '../worker/sprite';

/** Inline style that also carries CSS custom properties. */
export type CSSVars = CSSProperties & Readonly<Record<`--${string}`, string>>;

interface SpriteSvgProps {
  /** One entry per animation frame; each is rows of palette keys ('.' = clear). */
  readonly frames: readonly (readonly string[])[];
  readonly colors: Readonly<Record<string, string>>;
  /** CSS px per sprite cell. */
  readonly cell: number;
  readonly className?: string;
  readonly frameClassNames?: readonly (string | undefined)[];
  readonly style?: CSSVars;
}

/** Small DOM pixel sprite for the animated bits of a scene (flames, clouds, butterflies). */
export function SpriteSvg({
  frames,
  colors,
  cell,
  className,
  frameClassNames,
  style,
}: SpriteSvgProps): React.JSX.Element {
  const first = frames[0] ?? [];
  const cols = first[0]?.length ?? 0;
  const rows = first.length;
  return (
    <svg
      className={className}
      style={style}
      width={cols * cell}
      height={rows * cell}
      viewBox={`0 0 ${cols} ${rows}`}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {frames.map((frame, f) => (
        <g key={f} className={frameClassNames?.[f]}>
          {rowsToRuns(frame).map((r) => (
            <rect
              key={`${r.x},${r.y}`}
              x={r.x}
              y={r.y}
              width={r.w}
              height={1}
              fill={colors[r.key]}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}
