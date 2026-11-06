import type { AgentKind } from '@agent-office/shared';
import type { BrandIconFn } from 'reicon-brands/createIcon';
import { Claude } from 'reicon-brands/icons/Claude';
import { AgentIcon } from '../icons';
import { KIND_META } from './kind';

/** Reicon Brands package icons and pinned SVGs from its catalog. */
const LOGO: Partial<Record<AgentKind, { brand: BrandIconFn } | { asset: string }>> = {
  'claude-code': { brand: Claude },
  // Reicon Brands lists OpenAI, but the installed npm release omits that export.
  codex: { asset: '/brands/openai.svg' },
};

/** The logo's path data, drawn by React (no raw HTML injected). */
function pathsOf(logo: BrandIconFn): string[] {
  return [...logo.svgContent.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1] ?? '');
}

interface KindBadgeProps {
  readonly kind: AgentKind;
  readonly className?: string;
  /** Logo size in px. */
  readonly size?: number;
}

/**
 * Which agent this is, drawn in its brand color with no backdrop: the provider's logo when
 * Reicon has it, otherwise its two-letter badge, or a chip for unknown agents.
 */
export function KindBadge({ kind, className, size = 12 }: KindBadgeProps): React.JSX.Element {
  const meta = KIND_META[kind];
  const logo = LOGO[kind];
  return (
    <span
      className={className}
      style={{ color: meta.color }}
      role="img"
      aria-label={`${meta.label} by ${meta.provider}`}
      title={`${meta.label} by ${meta.provider}`}
    >
      {logo !== undefined && 'brand' in logo ? (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" focusable="false">
          {pathsOf(logo.brand).map((d, i) => (
            <path key={i} d={d} />
          ))}
        </svg>
      ) : logo !== undefined && 'asset' in logo ? (
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: size,
            height: size,
            backgroundColor: 'currentColor',
            maskImage: `url(${logo.asset})`,
            WebkitMaskImage: `url(${logo.asset})`,
            maskPosition: 'center',
            maskRepeat: 'no-repeat',
            maskSize: 'contain',
          }}
        />
      ) : kind === 'other' ? (
        <AgentIcon size={size} />
      ) : (
        meta.badge
      )}
    </span>
  );
}
