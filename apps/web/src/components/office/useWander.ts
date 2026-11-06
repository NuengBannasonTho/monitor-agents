import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point } from '../../lib/geometry';
import type { Rect } from '../../lib/useZoneRects';
import type { Crowd } from './crowd';
import type { Trajectory } from './crowd';
import { insideArea, landingSpot, planWalk, positionAt, standAt } from './crowd';

export interface WanderLeg {
  readonly to: Point;
  /** Seconds, so speed stays constant whatever the distance. */
  readonly duration: number;
  readonly facingLeft: boolean;
}

export interface Wander {
  /** Current walking leg, or null while the character should stand still. */
  readonly leg: WanderLeg | null;
  /**
   * Where to stand while not walking in camp: a clear landing spot on arrival, or wherever it
   * stopped (fell asleep, say). Null means its home spot.
   */
  readonly rest: Point | null;
  readonly moving: boolean;
  readonly facingLeft: boolean;
  /** Call when the character reaches the point it was heading to. */
  readonly arrive: (at: Point) => void;
}

interface WanderOptions {
  readonly id: string;
  /** May stroll now (in Base Camp, awake, motion allowed). */
  readonly active: boolean;
  /** In Base Camp at all: others must walk around it even while it stands still. */
  readonly inCamp: boolean;
  readonly area: Rect | null;
  /** Where it stands when not strolling. */
  readonly home: Point;
  readonly speedPxPerSec: number;
  /** Shared by everyone in Base Camp, so nobody walks into anybody. */
  readonly crowd: Crowd | null;
}

const PAUSE_MIN_MS = 1_200;
const PAUSE_MAX_MS = 4_200;

function pause(): number {
  return PAUSE_MIN_MS + Math.random() * (PAUSE_MAX_MS - PAUSE_MIN_MS);
}

/**
 * Lets a character stroll around Base Camp: stand a while, pick a spot whose whole route
 * stays clear of everyone else's, walk there with a gentle start and stop, repeat. If a new
 * plan (or a newcomer) gets in the way, it re-routes from where it is. Inactive (null leg)
 * when `active` is false, e.g. at work, while asleep, or with reduced motion.
 */
export function useWander({
  id,
  active,
  inCamp,
  area,
  home,
  speedPxPerSec,
  crowd,
}: WanderOptions): Wander {
  const [leg, setLeg] = useState<WanderLeg | null>(null);
  const [moving, setMoving] = useState(false);
  const [rest, setRest] = useState<Point | null>(null);
  const homeRef = useRef(home);
  const speedRef = useRef(speedPxPerSec);
  /** The plan in force when walking last stopped, and when: resumes a walk after a resize. */
  const lastPath = useRef<{ readonly path: Trajectory; readonly stoppedAt: number } | null>(null);
  useEffect(() => {
    homeRef.current = home;
    speedRef.current = speedPxPerSec;
  }, [home, speedPxPerSec]);

  const restRef = useRef<Point | null>(null);

  // Out of camp, the resting spot is forgotten: next time it lands on its home spot.
  if (!inCamp && rest !== null) setRest(null);

  const left = area?.left;
  const top = area?.top;
  const width = area?.width;
  const height = area?.height;

  // Arriving in camp: land on the home spot unless someone's plan comes near it.
  useEffect(() => {
    if (
      !inCamp ||
      crowd === null ||
      left === undefined ||
      top === undefined ||
      width === undefined ||
      height === undefined
    ) {
      restRef.current = null;
      return;
    }
    // A fresh visit: nothing from the last one carries over.
    lastPath.current = null;
    const spot = landingSpot(crowd, id, homeRef.current, { left, top, width, height }, Date.now());
    restRef.current = spot;
    setRest(spot);
    // Only on arrival; later resizes keep the character where it is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inCamp, crowd, id]);

  // The camp changed size (a panel opened, the window shrank): anyone left outside it
  // lands back inside, near home, instead of standing over the other panel or off screen.
  useEffect(() => {
    if (
      !inCamp ||
      crowd === null ||
      left === undefined ||
      top === undefined ||
      width === undefined ||
      height === undefined
    ) {
      return;
    }
    const box = { left, top, width, height };
    const spot = restRef.current;
    if (spot === null || insideArea(spot, box)) return;
    const landed = landingSpot(crowd, id, homeRef.current, box, Date.now());
    restRef.current = landed;
    setRest(landed);
  }, [inCamp, crowd, id, left, top, width, height]);

  // Leaving camp (or losing motion) cancels the walk immediately.
  if (!active && leg !== null) {
    setLeg(null);
    setMoving(false);
  }

  // Standing still in camp (asleep, reduced motion): still an obstacle for the walkers.
  const standX = rest?.x ?? home.x;
  const standY = rest?.y ?? home.y;
  useEffect(() => {
    if (!inCamp || active || crowd === null) return;
    const now = Date.now();
    crowd.set(id, standAt({ x: standX, y: standY }, now), now);
    return () => {
      crowd.remove(id);
    };
  }, [inCamp, active, crowd, id, standX, standY]);

  useEffect(() => {
    if (
      !active ||
      crowd === null ||
      left === undefined ||
      top === undefined ||
      width === undefined ||
      height === undefined
    ) {
      return;
    }
    const book = crowd;
    const box = { left, top, width, height };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const schedule = (ms: number): void => {
      clearTimeout(timer);
      timer = setTimeout(plan, ms);
    };
    let lastPlan = 0;
    const here = (now: number): Point => {
      const current = book.get(id);
      if (current !== undefined) return positionAt(current, now);
      // Woken up or re-run: it is wherever it stopped.
      const last = lastPath.current;
      if (last !== null) return positionAt(last.path, last.stoppedAt);
      return restRef.current ?? homeRef.current;
    };

    function plan(): void {
      if (disposed) return;
      const now = Date.now();
      // Two stuck characters asking each other to move must not spin.
      if (now - lastPlan < 250) {
        schedule(300);
        return;
      }
      lastPlan = now;
      const from = here(now);
      const walk = planWalk(book, id, from, box, speedRef.current, now, Math.random);
      if (walk === null) {
        // Nowhere clear to go: stop where it is (walkers heading here re-route) and look again.
        book.set(id, standAt(from, now), now);
        setLeg((current) =>
          current === null ? null : { to: from, duration: 0.35, facingLeft: current.facingLeft },
        );
        schedule(pause());
        return;
      }
      book.set(id, walk, now, false);
      setLeg({ to: walk.to, duration: walk.duration / 1000, facingLeft: walk.to.x < from.x });
      setMoving(true);
      // Stand a while at the end, then go again.
      schedule(walk.duration + pause());
    }

    const now = Date.now();
    const resumed = lastPath.current;
    lastPath.current = null;
    if (
      resumed !== null &&
      now - resumed.stoppedAt < 500 &&
      now < resumed.path.start + resumed.path.duration &&
      insideArea(resumed.path.to, box) &&
      insideArea(positionAt(resumed.path, now), box)
    ) {
      // Re-run mid-walk (the camp was resized): keep the walk already under way.
      book.set(id, resumed.path, now, false);
      schedule(resumed.path.start + resumed.path.duration - now + pause());
    } else {
      // Arriving or waking: stand where it is, or back inside if the camp shrank past it.
      const stopped =
        resumed === null
          ? (restRef.current ?? homeRef.current)
          : positionAt(resumed.path, resumed.stoppedAt);
      const from = insideArea(stopped, box)
        ? stopped
        : landingSpot(book, id, homeRef.current, box, now);
      if (from !== stopped) {
        restRef.current = from;
        setRest(from);
        setLeg(null);
      }
      // Claim the spot, and anyone walking into it re-routes.
      book.set(id, standAt(from, now), now);
      schedule(pause());
    }
    const unsubscribe = book.onConflict(id, plan);
    return () => {
      disposed = true;
      clearTimeout(timer);
      unsubscribe();
      const last = book.get(id);
      const stoppedAt = Date.now();
      book.remove(id);
      if (last !== undefined) {
        lastPath.current = { path: last, stoppedAt };
        // Stopping in camp (falling asleep): stay put rather than walk back home unplanned.
        restRef.current = positionAt(last, stoppedAt);
        setRest(restRef.current);
      }
    };
  }, [active, crowd, id, left, top, width, height]);

  const arrive = useCallback(() => {
    setMoving(false);
  }, []);

  return {
    leg: active ? leg : null,
    rest: inCamp ? rest : null,
    moving: active && moving,
    facingLeft: leg?.facingLeft ?? false,
    arrive,
  };
}
