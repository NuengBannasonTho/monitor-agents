import { describe, expect, it } from 'vitest';
import { formatRelative } from './relativeTime';

const NOW = 1_800_000_000_000;

describe('formatRelative', () => {
  it.each([
    [0, 'just now'],
    [4_999, 'just now'],
    [5_000, '5s ago'],
    [59_999, '59s ago'],
    [60_000, '1m ago'],
    [3_599_999, '59m ago'],
    [3_600_000, '1h ago'],
    [86_400_000 * 3, '3d ago'],
  ])('%i ms ago -> %s', (ago, expected) => {
    expect(formatRelative(NOW - ago, NOW)).toBe(expected);
  });

  it('treats future timestamps (clock skew) as just now', () => {
    expect(formatRelative(NOW + 10_000, NOW)).toBe('just now');
  });
});
