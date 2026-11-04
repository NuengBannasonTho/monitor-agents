import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point } from '../../lib/geometry';
import type { Rect } from '../../lib/useZoneRects';

export interface WanderLeg {
  readonly to: Point;
  /** Seconds, so speed stays constant whatever the distance. */
  readonly duration: number;
  readonly facingLeft: boolean;
}

export interface Wander {
  /** Current walking leg, or null while the character should stand on its slot. */
  readonly leg: WanderLeg | null;
  readonly moving: boolean;
  readonly facingLeft: boolean;
  /** Call when the character reaches the point it was heading to. */
  readonly arrive: (at: Point) => void;
}

const PAUSE_MIN_MS = 900;
const PAUSE_MAX_MS = 3_800;

/** Pure: next leg from `from` to a random point inside `area`. */
export function nextLeg(
  from: Point | null,
  area: Rect,
  speedPxPerSec: number,
  rand: () => number,
): WanderLeg {
  const to = { x: area.left + rand() * area.width, y: area.top + rand() * area.height };
  const distance = from === null ? 0 : Math.hypot(to.x - from.x, to.y - from.y);
  return {
    to,
    duration: Math.min(9, Math.max(0.5, distance / speedPxPerSec)),
    facingLeft: from !== null && to.x < from.x,
  };
}

/**
 * Lets a character stroll around an area: pause, pick a random point, walk
 * there at a constant speed, repeat. Inactive (null leg) when `active` is
 * false, e.g. at the table, while sleeping, or with reduced motion.
 */
export function useWander(active: boolean, area: Rect | null, speedPxPerSec: number): Wander {
  const [leg, setLeg] = useState<WanderLeg | null>(null);
  const [moving, setMoving] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);
  const [arrivals, setArrivals] = useState(0);
  const position = useRef<Point | null>(null);

  // Leaving the lounge (or losing motion) cancels the walk immediately.
  if (!active && leg !== null) {
    setLeg(null);
    setMoving(false);
  }

  const left = area?.left;
  const top = area?.top;
  const width = area?.width;
  const height = area?.height;

  useEffect(() => {
    if (
      !active ||
      left === undefined ||
      top === undefined ||
      width === undefined ||
      height === undefined
    ) {
      return;
    }
    const pause = PAUSE_MIN_MS + Math.random() * (PAUSE_MAX_MS - PAUSE_MIN_MS);
    const timer = setTimeout(() => {
      const next = nextLeg(
        position.current,
        { left, top, width, height },
        speedPxPerSec,
        Math.random,
      );
      setLeg(next);
      setMoving(true);
      setFacingLeft(next.facingLeft);
    }, pause);
    return () => {
      clearTimeout(timer);
    };
  }, [active, left, top, width, height, speedPxPerSec, arrivals]);

  const arrive = useCallback((at: Point) => {
    position.current = at;
    setMoving(false);
    setArrivals((n) => n + 1);
  }, []);

  return { leg: active ? leg : null, moving: active && moving, facingLeft, arrive };
}
