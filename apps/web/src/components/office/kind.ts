import type { AgentKind } from '@agent-office/shared';

export interface KindMeta {
  readonly label: string;
  readonly provider: string;
  /** Two-letter badge, for agents without a provider logo (see KindBadge). */
  readonly badge: string;
  readonly color: string;
}

export const KIND_META: Readonly<Record<AgentKind, KindMeta>> = {
  'claude-code': {
    label: 'Claude Code',
    provider: 'Anthropic',
    badge: 'CC',
    color: '#d97757',
  },
  codex: { label: 'Codex', provider: 'OpenAI', badge: 'CX', color: '#5b8def' },
  other: {
    label: 'Other agent',
    provider: 'Other',
    badge: '··',
    color: '#8b8f9c',
  },
};
