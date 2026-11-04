import { describe, expect, it } from 'vitest';
import { DESK_PITCH_Y, deskGrid, loungeGrid, loungeSlotPosition } from './geometry';
import { assignSlots, sameAssignment } from './slots';

describe('assignSlots', () => {
  it('assigns lowest free slots in order', () => {
    const m = assignSlots(new Map(), ['a', 'b', 'c']);
    expect([...m]).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ]);
  });

  it('keeps existing seats stable when others leave and join', () => {
    const first = assignSlots(new Map(), ['a', 'b', 'c']);
    const second = assignSlots(first, ['c', 'a']); // b left
    expect(second.get('a')).toBe(0);
    expect(second.get('c')).toBe(2);
    const third = assignSlots(second, ['c', 'a', 'd', 'e']);
    expect(third.get('a')).toBe(0);
    expect(third.get('c')).toBe(2);
    expect(third.get('d')).toBe(1); // fills the gap b left
    expect(third.get('e')).toBe(3);
  });

  it('does not depend on input order for existing holders', () => {
    const first = assignSlots(new Map(), ['a', 'b']);
    expect(assignSlots(first, ['b', 'a'])).toEqual(first);
  });

  it('does not mutate the previous map', () => {
    const prev = new Map([['a', 0]]);
    assignSlots(prev, ['b']);
    expect([...prev]).toEqual([['a', 0]]);
  });

  it('never assigns the same slot twice', () => {
    let m = new Map<string, number>();
    for (let round = 0; round < 50; round++) {
      const ids = Array.from({ length: (round * 7) % 13 }, (_, i) => `id${(i * round) % 17}`);
      m = assignSlots(m, [...new Set(ids)]);
      const slots = [...m.values()];
      expect(new Set(slots).size).toBe(slots.length);
    }
  });

  it('sameAssignment compares by content', () => {
    expect(sameAssignment(new Map([['a', 1]]), new Map([['a', 1]]))).toBe(true);
    expect(sameAssignment(new Map([['a', 1]]), new Map([['a', 2]]))).toBe(false);
  });
});

describe('deskGrid', () => {
  const zone = { width: 840, height: 820 };
  const horizon = 170;

  it('fills the plaza with desks even when few are needed', () => {
    const g = deskGrid(zone, horizon, 1);
    expect(g.cols).toBe(7);
    expect(g.rows).toBe(4);
    expect(g.desks).toHaveLength(28);
  });

  it('fills from the middle of the plaza outward', () => {
    const g = deskGrid({ width: 420, height: 460 }, 120, 1);
    expect(g.cols).toBe(3);
    expect(g.rows).toBe(2);
    expect(g.fillOrder.slice(0, 2)).toEqual([1, 4]);
    expect([...g.fillOrder].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('never leaves an agent without a desk', () => {
    for (const needed of [0, 6, 7, 30, 40]) {
      const g = deskGrid({ width: 420, height: 460 }, 120, needed);
      expect(g.desks.length).toBeGreaterThanOrEqual(needed);
      expect(new Set(g.fillOrder).size).toBe(g.desks.length);
    }
  });

  it('keeps every desk inside the zone and below the skyline', () => {
    for (const size of [
      { width: 420, height: 460 },
      { width: 343, height: 580 },
      { width: 840, height: 820 },
    ]) {
      for (const needed of [1, 12, 40]) {
        const g = deskGrid(size, horizon, needed);
        for (const d of g.desks) {
          expect(d.x - 50).toBeGreaterThanOrEqual(0);
          expect(d.x + 50).toBeLessThanOrEqual(size.width);
          expect(d.y).toBeGreaterThan(horizon);
          expect(d.y).toBeLessThan(size.height);
        }
      }
    }
  });

  it('keeps rows a full pitch apart while they fit', () => {
    const g = deskGrid(zone, horizon, 10);
    const first = g.desks[0];
    const below = g.desks[g.cols];
    expect(first).toBeDefined();
    expect(below).toBeDefined();
    if (first === undefined || below === undefined) return;
    expect(below.y - first.y).toBe(DESK_PITCH_Y);
  });
});

describe('lounge layout', () => {
  it('keeps slot centers inside the padded zone', () => {
    const zone = { width: 420, height: 360 };
    const grid = loungeGrid(zone, 9, 120);
    for (let slot = 0; slot < 9; slot++) {
      const p = loungeSlotPosition(zone, grid, slot, { x: 50, y: 60 }, `agent-${slot}`);
      expect(p.x).toBeGreaterThanOrEqual(50);
      expect(p.x).toBeLessThanOrEqual(370);
      expect(p.y).toBeGreaterThanOrEqual(60);
      expect(p.y).toBeLessThanOrEqual(300);
    }
  });

  it('is deterministic per agent', () => {
    const zone = { width: 400, height: 300 };
    const grid = loungeGrid(zone, 4, 120);
    const a = loungeSlotPosition(zone, grid, 2, { x: 40, y: 40 }, 'x');
    const b = loungeSlotPosition(zone, grid, 2, { x: 40, y: 40 }, 'x');
    expect(a).toEqual(b);
  });
});
