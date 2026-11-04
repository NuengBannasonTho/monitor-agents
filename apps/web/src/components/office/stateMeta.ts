import type { AgentState } from '@agent-office/shared';

export const STATE_LABEL: Readonly<Record<AgentState, string>> = {
  idle: 'Idle',
  called: 'Called',
  working: 'Working',
  reading: 'Reading',
  running: 'Running',
  'needs-you': 'Needs you',
  done: 'Done',
  stale: 'Stale',
};

export const STATE_COLOR_VAR: Readonly<Record<AgentState, string>> = {
  idle: 'var(--state-idle)',
  called: 'var(--state-called)',
  working: 'var(--state-working)',
  reading: 'var(--state-reading)',
  running: 'var(--state-running)',
  'needs-you': 'var(--state-needs-you)',
  done: 'var(--state-done)',
  stale: 'var(--state-stale)',
};
