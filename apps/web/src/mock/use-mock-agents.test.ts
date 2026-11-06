import { describe, expect, it } from 'vitest';
import { mockAgentCountFromUrl } from './use-mock-agents';

describe('mockAgentCountFromUrl', () => {
  it('defaults to 6', () => {
    expect(mockAgentCountFromUrl('')).toBe(6);
  });
  it('reads ?agents=N and clamps', () => {
    expect(mockAgentCountFromUrl('?agents=14')).toBe(14);
    expect(mockAgentCountFromUrl('?agents=999')).toBe(40);
    expect(mockAgentCountFromUrl('?agents=abc')).toBe(6);
  });
  it('prefers #agents-N', () => {
    expect(mockAgentCountFromUrl('?agents=3', '#agents-12')).toBe(12);
    expect(mockAgentCountFromUrl('', '#gallery')).toBe(6);
  });
});
