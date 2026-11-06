import type { CustomAgent } from '@agent-office/shared';
import { describe, expect, it } from 'vitest';
import { NEW_DRAFT, draftOf, inputOf, sameDraft, toolsOf } from './schema';

const agent: CustomAgent = {
  scope: 'user',
  file: 'reviewer.md',
  path: '/home/me/.claude/agents/reviewer.md',
  name: 'reviewer',
  description: 'Reviews code',
  tools: ['Grep', 'Read', 'mcp__github__get_issue', 'Bash(git diff:*)'],
  model: 'sonnet',
  color: 'teal',
  prompt: 'Review.\n\n',
  note: null,
  problem: null,
  modifiedAt: 1,
};

describe('the custom agent form', () => {
  it('splits tools into toggles and other tools, and drops a color Claude Code lacks', () => {
    const draft = draftOf(agent);
    expect(draft.tools).toEqual(['Grep', 'Read']);
    expect(draft.otherTools).toBe('mcp__github__get_issue, Bash(git diff:*)');
    expect(draft.color).toBeNull();
    expect(draft.prompt).toBe('Review.');
    // The file's order is kept, so saving an untouched list leaves it as it was.
    expect(toolsOf(draft)).toEqual(['Grep', 'Read', 'mcp__github__get_issue', 'Bash(git diff:*)']);
  });

  it('reads no tools line as every tool', () => {
    expect(draftOf({ ...agent, tools: null }).allTools).toBe(true);
    expect(toolsOf({ ...NEW_DRAFT, allTools: true })).toBeNull();
  });

  it('builds the input, or says what to fix', () => {
    const result = inputOf({ ...draftOf(agent), model: '' });
    expect(result).toMatchObject({ ok: true, input: { name: 'reviewer', model: null } });

    const bad = inputOf({ ...NEW_DRAFT, name: 'My Agent', allTools: false, tools: [] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(Object.keys(bad.errors).sort()).toEqual(['description', 'name', 'tools']);
    }
  });

  it('notices changes', () => {
    expect(sameDraft(draftOf(agent), draftOf(agent))).toBe(true);
    expect(sameDraft(draftOf(agent), { ...draftOf(agent), color: 'red' })).toBe(false);
  });
});
