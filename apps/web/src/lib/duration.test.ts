import { describe, expect, it } from 'vitest';
import { formatSpan, formatSpanShort } from './duration';

describe('duration', () => {
  it.each([
    [0, 'under a minute', '<1m'],
    [59_000, 'under a minute', '<1m'],
    [4 * 60_000 + 30_000, '4 min', '4m'],
    [120 * 60_000, '2 h', '2h'],
    [125 * 60_000, '2 h 5 min', '2h5m'],
    [-5, 'under a minute', '<1m'],
  ])('%d ms', (ms, long, short) => {
    expect(formatSpan(ms)).toBe(long);
    expect(formatSpanShort(ms)).toBe(short);
  });
});
