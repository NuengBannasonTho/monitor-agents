import type { AgentKind } from '@agent-office/shared';

export interface KindMeta {
  readonly label: string;
  /** Two-letter badge shown in the name tag (brand-neutral on purpose). */
  readonly badge: string;
  readonly color: string;
}

export const KIND_META: Readonly<Record<AgentKind, KindMeta>> = {
  'claude-code': { label: 'Claude Code', badge: 'CC', color: '#d97757' },
  codex: { label: 'Codex', badge: 'CX', color: '#5b8def' },
  other: { label: 'Other agent', badge: '··', color: '#8b8f9c' },
};
