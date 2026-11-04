import { describe, expect, it } from 'vitest';
import { hueForSession } from './hue';
import { hashString, seededRandom } from './seed';

function inRedFamily(hue: number): boolean {
  return hue >= 336 || hue <= 6;
}

describe('hueForSession', () => {
  it('is deterministic', () => {
    expect(hueForSession('abc-123')).toBe(hueForSession('abc-123'));
  });

  it('stays in the red/pink/crimson family for many ids', () => {
    for (let i = 0; i < 2000; i++) {
      const hue = hueForSession(`session-${i}-${(i * 7919).toString(36)}`);
      expect(inRedFamily(hue), `hue ${hue}`).toBe(true);
    }
  });

  it('produces variety', () => {
    const hues = new Set(Array.from({ length: 50 }, (_, i) => hueForSession(`s${i}`)));
    expect(hues.size).toBeGreaterThan(10);
  });
});

describe('seededRandom', () => {
  it('repeats for the same seed and stays in [0, 1)', () => {
    const a = seededRandom(hashString('x'));
    const b = seededRandom(hashString('x'));
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
