import { describe, expect, it } from 'vitest';
import { redactSecrets, truncate } from './redact.js';
import { BASH_MAX, relativeToCwd, stateForTool, summarizeTool } from './summarize.js';

describe('redactSecrets', () => {
  it.each([
    ['OpenAI/Anthropic keys', 'use sk-ant-api03-abcdef123456 now', 'use [REDACTED] now'],
    ['GitHub tokens', 'git clone https://ghp_ABCDEFGHIJ1234567890@github.com', '[REDACTED]'],
    ['GitHub fine-grained', 'github_pat_11ABCDEFG0123456789_xyz', '[REDACTED]'],
    ['Slack tokens', 'xoxb-123456789-abcdef', '[REDACTED]'],
    ['AWS key ids', 'AKIAIOSFODNN7EXAMPLE', '[REDACTED]'],
    ['key=value', 'API_KEY=supersecret pnpm dev', 'API_KEY=[REDACTED] pnpm dev'],
    ['token: value', 'token: abc123', 'token: [REDACTED]'],
    ['password="quoted"', 'password="hunter 2" x', 'password=[REDACTED] x'],
    ['--password flag', 'mysql --password hunter2 db', 'mysql --password [REDACTED] db'],
    ['Bearer header', 'Authorization: Bearer abcdefghijklmnop', 'Bearer [REDACTED]'],
    ['URL credentials', 'postgres://me:hunter2@db:5432/x', 'postgres://me:[REDACTED]@db:5432/x'],
  ])('%s', (_label, input, expected) => {
    const out = redactSecrets(input);
    expect(out).toContain(expected);
  });

  it('leaves ordinary commands alone', () => {
    expect(redactSecrets('pnpm test --filter api')).toBe('pnpm test --filter api');
    expect(redactSecrets('git commit -m "fix keyboard focus"')).toBe(
      'git commit -m "fix keyboard focus"',
    );
  });

  it('removes prefixed tokens wherever they appear', () => {
    for (const secret of ['sk-live-0123456789', 'ghp_0123456789abcdef', 'xoxp-1234-5678-abcd']) {
      expect(redactSecrets(`echo ${secret} | pbcopy`)).not.toContain(secret);
    }
  });

  it('removes the value of a secret-named assignment', () => {
    expect(redactSecrets('X_SECRET=hunter2hunter2 && make')).not.toContain('hunter2');
  });
});

describe('summaries', () => {
  const cwd = '/w/feat-auth';

  it('maps tools to states', () => {
    expect(['Read', 'Grep', 'Glob'].map(stateForTool)).toEqual(['reading', 'reading', 'reading']);
    expect(stateForTool('Bash')).toBe('running');
    expect(stateForTool('Edit')).toBe('working');
    expect(stateForTool('mcp__github__create_issue')).toBe('working');
  });

  it('makes file paths relative to cwd, but not paths outside it', () => {
    expect(relativeToCwd('/w/feat-auth/src/a.ts', cwd)).toBe('src/a.ts');
    expect(relativeToCwd('/etc/hosts', cwd)).toBe('/etc/hosts');
    expect(relativeToCwd('/w/feat-auth-2/x.ts', cwd)).toBe('/w/feat-auth-2/x.ts');
  });

  it('summarizes each tool with its target only', () => {
    expect(summarizeTool('Read', { file_path: '/w/feat-auth/a.ts' }, cwd)).toBe('Read a.ts');
    expect(summarizeTool('Grep', { pattern: 'useSession', path: '/w' }, cwd)).toBe(
      'Grep "useSession"',
    );
    expect(summarizeTool('Glob', { pattern: 'src/**/*.ts' }, cwd)).toBe('Glob src/**/*.ts');
    expect(summarizeTool('Write', { file_path: '/w/feat-auth/b.ts', content: 'SECRET' }, cwd)).toBe(
      'Write b.ts',
    );
    expect(summarizeTool('WebFetch', { url: 'https://x.test/?token=abc' }, cwd)).toBe('WebFetch');
  });

  it('truncates Bash to 80 characters after redacting', () => {
    const long = `OPENAI_API_KEY=sk-0123456789abcdef ${'x'.repeat(200)}`;
    const summary = summarizeTool('Bash', { command: long }, cwd);
    const command = summary.slice('Bash '.length);
    expect(Array.from(command).length).toBeLessThanOrEqual(BASH_MAX);
    expect(summary).not.toContain('0123456789abcdef');
    expect(summary.startsWith('Bash OPENAI_API_KEY=[REDACTED]')).toBe(true);
  });

  it('flattens multi-line commands', () => {
    expect(summarizeTool('Bash', { command: 'echo a\n  && echo b' }, cwd)).toBe(
      'Bash echo a && echo b',
    );
  });

  it('truncate respects the limit', () => {
    expect(truncate('abcdef', 4)).toBe('abc…');
    expect(truncate('abc', 4)).toBe('abc');
  });
});
