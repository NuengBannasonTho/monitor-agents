import { describe, expect, it } from 'vitest';
import { StartTaskSchema, leadPrompt, worktreeNameFor } from './tasks.js';

describe('starting a task', () => {
  it('sends the task alone without a team', () => {
    expect(leadPrompt('  Fix the login bug \n', [])).toBe('Fix the login bug');
  });

  it('tells the lead how to work with its team', () => {
    const prompt = leadPrompt('Add a settings page', [
      { name: 'code-reviewer', description: 'Reviews code\nafter edits.' },
      { name: 'test-runner', description: '' },
    ]);
    expect(prompt.startsWith('Add a settings page\n\nYou lead this task')).toBe(true);
    expect(prompt).toContain('- code-reviewer: Reviews code after edits.\n- test-runner');
  });

  it('names a worktree after the task', () => {
    expect(worktreeNameFor('Fix the login bug on Safari, then add tests')).toBe(
      'fix-the-login-bug-on-safari',
    );
    expect(worktreeNameFor('Add a wishlist page: a heart button on each product')).toBe(
      'add-a-wishlist-page',
    );
    expect(worktreeNameFor('แก้บั๊กหน้า login')).toBe('login');
    expect(worktreeNameFor('ทดสอบ')).toBe('task');
  });

  it('checks where it runs and who helps', () => {
    const ok = StartTaskSchema.safeParse({
      task: 'x',
      where: { kind: 'new', repoId: 'r1', name: 'fix-login' },
    });
    expect(ok.success && ok.data.team).toEqual([]);
    expect(
      StartTaskSchema.safeParse({ task: 'x', where: { kind: 'new', repoId: 'r1', name: '../x' } })
        .success,
    ).toBe(false);
    expect(
      StartTaskSchema.safeParse({
        task: ' ',
        where: { kind: 'existing', worktreeId: 'w' },
      }).success,
    ).toBe(false);
  });
});
