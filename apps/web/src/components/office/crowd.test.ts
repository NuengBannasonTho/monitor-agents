import { describe, expect, it } from 'vitest';
import { Crowd, clearance, planWalk, positionAt, standAt, walkEase } from './crowd';

const area = { left: 0, top: 0, width: 600, height: 400 };

/** Deterministic random numbers. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe('crowd', () => {
  it('eases in and out along the walk', () => {
    expect(walkEase(0)).toBe(0);
    expect(walkEase(0.5)).toBe(0.5);
    expect(walkEase(1)).toBe(1);
    const path = { from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, start: 1000, duration: 2000 };
    expect(positionAt(path, 500)).toEqual({ x: 0, y: 0 });
    expect(positionAt(path, 2000).x).toBeCloseTo(50);
    expect(positionAt(path, 9000)).toEqual({ x: 100, y: 0 });
  });

  it('sees two walkers crossing paths', () => {
    const a = { from: { x: 0, y: 100 }, to: { x: 400, y: 100 }, start: 0, duration: 4000 };
    const b = { from: { x: 200, y: -100 }, to: { x: 200, y: 300 }, start: 0, duration: 4000 };
    expect(clearance(a, b, 0)).toBeLessThan(1);
    const far = standAt({ x: 200, y: 380 }, 0);
    expect(clearance(a, far, 0)).toBeGreaterThan(1);
  });

  it('only plans walks that keep clear of everyone, the whole way', () => {
    const crowd = new Crowd();
    const rand = seeded(7);
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const spots = [
      { x: 80, y: 80 },
      { x: 520, y: 80 },
      { x: 80, y: 320 },
      { x: 520, y: 320 },
      { x: 300, y: 200 },
    ];
    ids.forEach((id, i) => {
      crowd.set(id, standAt(spots[i] ?? { x: 0, y: 0 }, 0), 0, false);
    });
    for (let round = 0; round < 20; round++) {
      const id = ids[round % ids.length] ?? 'a';
      const now = round * 500;
      const from = positionAt(crowd.get(id) ?? standAt({ x: 0, y: 0 }, now), now);
      const walk = planWalk(crowd, id, from, area, 40, now, rand);
      if (walk === null) continue;
      expect(crowd.gap(id, walk, now)).toBeGreaterThanOrEqual(1);
      crowd.set(id, walk, now, false);
    }
  });

  it('asks whoever is in the way to step aside', async () => {
    const crowd = new Crowd();
    let asked = 0;
    crowd.set(
      'walker',
      { from: { x: 0, y: 0 }, to: { x: 400, y: 0 }, start: 0, duration: 5000 },
      0,
    );
    crowd.onConflict('walker', () => {
      asked += 1;
    });
    crowd.set('newcomer', standAt({ x: 200, y: 10 }, 0), 0);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(asked).toBe(1);
  });
});

describe('crowd squeeze', () => {
  it('lets two characters that landed on each other walk apart', () => {
    const crowd = new Crowd();
    crowd.set('a', standAt({ x: 300, y: 200 }, 0), 0, false);
    const walk = planWalk(crowd, 'b', { x: 310, y: 205 }, area, 40, 0, seeded(3));
    expect(walk).not.toBeNull();
  });
});
