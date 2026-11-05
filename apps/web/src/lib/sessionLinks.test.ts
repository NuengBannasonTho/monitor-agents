import { describe, expect, it } from 'vitest';
import { editorUrl, resumeCommand } from './sessionLinks';

describe('session links', () => {
  it('opens the folder in VS Code, encoding spaces', () => {
    expect(editorUrl('/Users/me/My Projects/app')).toBe('vscode://file/Users/me/My%20Projects/app');
  });

  it('builds a resume command with a safely quoted folder', () => {
    expect(resumeCommand({ kind: 'claude-code', id: 'abc-123', cwd: "/w/it's here" })).toBe(
      "cd '/w/it'\\''s here' && claude --resume abc-123",
    );
    expect(resumeCommand({ kind: 'codex', id: 'x', cwd: '/w' })).toBeNull();
  });
});
