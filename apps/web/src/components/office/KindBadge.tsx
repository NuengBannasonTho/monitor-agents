import type { AgentKind } from '@agent-office/shared';
import type { BrandIconFn } from 'reicon-brands/createIcon';
import { Claude } from 'reicon-brands/icons/Claude';
import { AgentIcon } from '../icons';
import { KIND_META } from './kind';

/** Provider logos from Reicon Brands (https://brands.reicon.dev), where one exists. */
const LOGO: Partial<Record<AgentKind, BrandIconFn>> = {
  'claude-code': Claude,
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
 * Reicon has it (Claude), otherwise its two-letter badge, or a chip for unknown agents.
 */
export function KindBadge({ kind, className, size = 12 }: KindBadgeProps) {
  const meta = KIND_META[kind];
  const logo = LOGO[kind];
  return (
    <span className={className} style={{ color: meta.color }} aria-hidden>
      {logo !== undefined ? (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" focusable="false">
          {pathsOf(logo).map((d, i) => (
            <path key={i} d={d} />
          ))}
        </svg>
      ) : kind === 'other' ? (
        <AgentIcon size={size} />
      ) : (
        meta.badge
      )}
    </span>
  );
}
