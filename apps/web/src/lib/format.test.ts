import { describe, expect, it } from 'vitest';
import { formatDay, formatShare, formatTokens, formatUsd, plural } from './format';

describe('formatUsd', () => {
  it('rounds to what is worth reading', () => {
    expect(formatUsd(0)).toBe('$0');
    expect(formatUsd(0.004)).toBe('<$0.01');
    expect(formatUsd(0.42)).toBe('$0.42');
    expect(formatUsd(12.3)).toBe('$12.30');
    expect(formatUsd(1284.4)).toBe('$1,284');
  });
});

describe('formatTokens', () => {
  it('goes compact past a thousand', () => {
    expect(formatTokens(940)).toBe('940');
    expect(formatTokens(12_900)).toBe('12.9K');
    expect(formatTokens(4_000_000)).toBe('4M');
    expect(formatTokens(576_601_736)).toBe('577M');
    expect(formatTokens(1_300_000_000)).toBe('1.3B');
  });
});

describe('formatShare', () => {
  it('never shows a tiny share as 0%', () => {
    expect(formatShare(0, 10)).toBe('0%');
    expect(formatShare(0.01, 10)).toBe('<1%');
    expect(formatShare(3.7, 10)).toBe('37%');
    expect(formatShare(1, 0)).toBe('0%');
  });
});

describe('formatDay', () => {
  it('reads a local date', () => {
    expect(formatDay('2026-11-06')).toBe('Nov 6');
    expect(formatDay('2026-11-06', { weekday: 'short' })).toBe('Fri, Nov 6');
  });
});

describe('plural', () => {
  it('counts one and many', () => {
    expect(plural(1, 'session')).toBe('1 session');
    expect(plural(0, 'skill')).toBe('0 skills');
    expect(plural(1284, 'request')).toBe('1,284 requests');
  });
});
