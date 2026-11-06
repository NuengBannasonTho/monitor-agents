import { describe, expect, it } from 'vitest';
import { activityKind } from './activity-kind';

describe('activityKind', () => {
  it.each([
    [{ state: 'called', summary: 'Prompt received' }, 'prompt'],
    [{ state: 'reading', summary: 'Read src/a.ts' }, 'read'],
    [{ state: 'reading', summary: 'Grep "useSession"' }, 'search'],
    [{ state: 'running', summary: 'Bash pnpm test' }, 'terminal'],
    [{ state: 'working', summary: 'Edit src/a.ts (subagent Explore)' }, 'edit'],
    [{ state: 'needs-you', summary: 'Needs permission' }, 'permission'],
    [{ state: 'working', summary: 'Subagent finished: Explore' }, 'subagent'],
    [{ state: 'done', summary: 'Finished' }, 'finished'],
    [{ state: 'idle', summary: 'Session resumed' }, 'start'],
    [{ state: 'idle', summary: 'Context compacted' }, 'context'],
    [{ state: 'stale', summary: 'No events for 5 min' }, 'sleep'],
    [{ state: 'running', summary: 'Bash failed (exit 1)', failed: true }, 'failed'],
    [{ state: 'working', summary: 'mcp__github__create_issue' }, 'other'],
  ] as const)('%j -> %s', (entry, kind) => {
    expect(activityKind(entry)).toBe(kind);
  });
});
