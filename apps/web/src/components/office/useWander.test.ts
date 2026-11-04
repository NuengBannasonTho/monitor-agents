import { describe, expect, it } from 'vitest';
import { nextLeg } from './useWander';

const area = { left: 100, top: 50, width: 200, height: 100 };

describe('nextLeg', () => {
  it('always picks a point inside the area', () => {
    for (const r of [0, 0.25, 0.999]) {
      const leg = nextLeg({ x: 150, y: 80 }, area, 40, () => r);
      expect(leg.to.x).toBeGreaterThanOrEqual(100);
      expect(leg.to.x).toBeLessThanOrEqual(300);
      expect(leg.to.y).toBeGreaterThanOrEqual(50);
      expect(leg.to.y).toBeLessThanOrEqual(150);
    }
  });

  it('walks at constant speed, clamped to 0.5–9 s', () => {
    expect(nextLeg({ x: 100, y: 50 }, area, 40, () => 1).duration).toBeCloseTo(
      Math.hypot(200, 100) / 40,
    );
    expect(nextLeg({ x: 100, y: 50 }, area, 40, () => 0).duration).toBe(0.5);
    expect(nextLeg({ x: -5000, y: 50 }, area, 40, () => 0).duration).toBe(9);
  });

  it('faces the direction of travel', () => {
    expect(nextLeg({ x: 300, y: 80 }, area, 40, () => 0).facingLeft).toBe(true);
    expect(nextLeg({ x: 100, y: 80 }, area, 40, () => 1).facingLeft).toBe(false);
  });
});
