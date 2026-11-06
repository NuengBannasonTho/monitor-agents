import { describe, expect, it } from 'vitest';
import { errnoCode, isRecord, stringField } from './guards.js';

describe('guards', () => {
  it('tells plain objects from null, arrays and other values', () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord([1])).toBe(false);
    expect(isRecord('x')).toBe(false);
  });

  it('reads an errno code only when there is one', () => {
    expect(errnoCode(Object.assign(new Error('x'), { code: 'EEXIST' }))).toBe('EEXIST');
    expect(errnoCode(new Error('x'))).toBeUndefined();
    expect(errnoCode('EEXIST')).toBeUndefined();
  });

  it('reads a string field of a JSON object', () => {
    expect(stringField({ error: 'Nope' }, 'error')).toBe('Nope');
    expect(stringField({ error: 3 }, 'error')).toBeNull();
    expect(stringField(null, 'error')).toBeNull();
  });
});
