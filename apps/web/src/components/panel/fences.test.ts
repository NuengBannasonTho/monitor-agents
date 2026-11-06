import { describe, expect, it } from 'vitest';
import { splitFences } from './fences';

describe('splitFences', () => {
  it('keeps plain prose as one text segment', () => {
    expect(splitFences('Done.\nAll tests pass.')).toEqual([
      { kind: 'text', text: 'Done.\nAll tests pass.' },
    ]);
  });

  it('pulls fenced code out with its language', () => {
    expect(splitFences('Fixed:\n\n```ts\nconst a = 1;\n```\n\nThat is all.')).toEqual([
      { kind: 'text', text: 'Fixed:' },
      { kind: 'code', code: 'const a = 1;', lang: 'ts' },
      { kind: 'text', text: 'That is all.' },
    ]);
  });

  it('treats a fence with no language as plain text, and an open fence as running to the end', () => {
    expect(splitFences('```\nls -la\n```')).toEqual([
      { kind: 'code', code: 'ls -la', lang: 'text' },
    ]);
    expect(splitFences('See:\n```bash\npnpm test\n… 4 more lines')).toEqual([
      { kind: 'text', text: 'See:' },
      { kind: 'code', code: 'pnpm test\n… 4 more lines', lang: 'bash' },
    ]);
  });
});
