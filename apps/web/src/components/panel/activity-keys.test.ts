import { describe, expect, it } from 'vitest';
import type { ActivityEntry } from '@agent-office/shared';
import { activityKeys } from './activity-keys';

const e = (at: number, summary = 'Read a.ts'): ActivityEntry => ({ at, state: 'reading', summary });

describe('activityKeys', () => {
  it('is unique for identical entries', () => {
    const keys = activityKeys([e(1), e(1), e(1)]);
    expect(new Set(keys).size).toBe(3);
  });

  it('keeps existing keys stable when a newer entry is prepended', () => {
    const before = [e(2), e(1), e(1)];
    const after = [e(3), ...before];
    expect(activityKeys(after).slice(1)).toEqual(activityKeys(before));
  });
});
