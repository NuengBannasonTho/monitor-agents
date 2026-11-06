import { describe, expect, it } from 'vitest';
import { modelLabel } from './modelLabel';

describe('modelLabel', () => {
  it('names Claude models the way people say them', () => {
    expect(modelLabel('claude-opus-5-5')).toBe('Opus 5.5');
    expect(modelLabel('claude-sonnet-5')).toBe('Sonnet 5');
    expect(modelLabel('claude-haiku-4-5')).toBe('Haiku 4.5');
    expect(modelLabel('claude-opus-4-20250514')).toBe('Opus 4');
    expect(modelLabel('gpt-9')).toBe('gpt-9');
  });
});
