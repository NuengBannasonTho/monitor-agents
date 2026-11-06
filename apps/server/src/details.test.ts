import { describe, expect, it } from 'vitest';
import { clipHead, clipTail, langForPath } from './details.js';

describe('details helpers', () => {
  it('cuts long text at the end, saying how many lines were dropped', () => {
    expect(clipHead('a\nb\nc\nd', 3)).toBe('a\nb\n… 2 more lines');
    expect(clipHead('short', 10)).toBe('short');
  });

  it('keeps the end of long output', () => {
    expect(clipTail('0123456789', 4)).toBe('… earlier output trimmed\n6789');
  });

  it('picks a highlighting language from the file name', () => {
    expect(langForPath('src/App.tsx')).toBe('tsx');
    expect(langForPath('/x/Dockerfile')).toBe('docker');
    expect(langForPath('notes.unknown')).toBe('text');
    expect(langForPath('Makefile')).toBe('text');
  });
});
