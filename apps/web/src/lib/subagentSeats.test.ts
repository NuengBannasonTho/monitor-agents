import { describe, expect, it } from 'vitest';
import type { DeskGrid } from './geometry';
import { MINI_DESK_OFFSET_X, placesForSubagents, seatSubagents } from './geometry';

/** 2 rows of 5 places, filled from the middle. */
const grid: DeskGrid = {
  cols: 5,
  rows: 2,
  desks: Array.from({ length: 10 }, (_, i) => ({ x: (i % 5) * 112, y: Math.floor(i / 5) * 172 })),
  fillOrder: [2, 7, 1, 3, 6, 8, 0, 4, 5, 9],
};

describe('seatSubagents', () => {
  it('needs one place per pair of subagents', () => {
    expect([0, 1, 2, 3, 4].map(placesForSubagents)).toEqual([0, 1, 1, 2, 2]);
  });

  it('puts a pair side by side in the place right of the agent', () => {
    const seats = seatSubagents(grid, [{ id: 'a', home: 2, subagents: 2 }]);
    expect(seats.get('a')).toEqual([
      { place: 3, dx: -MINI_DESK_OFFSET_X },
      { place: 3, dx: MINI_DESK_OFFSET_X },
    ]);
  });

  it('centers a lone subagent in its place', () => {
    expect(seatSubagents(grid, [{ id: 'a', home: 2, subagents: 1 }]).get('a')).toEqual([
      { place: 3, dx: 0 },
    ]);
  });

  it('goes left when another agent sits to the right, and never takes an agent desk', () => {
    const seats = seatSubagents(grid, [
      { id: 'a', home: 2, subagents: 3 },
      { id: 'b', home: 3, subagents: 0 },
    ]);
    expect(seats.get('a')?.map((s) => s.place)).toEqual([1, 1, 0]);
  });

  it('seats subagents of an agent in Base Camp in the middle of the plaza', () => {
    const seats = seatSubagents(grid, [
      { id: 'a', home: 2, subagents: 0 },
      { id: 'camp', home: null, subagents: 1 },
    ]);
    expect(seats.get('camp')).toEqual([{ place: 7, dx: 0 }]);
  });
});
