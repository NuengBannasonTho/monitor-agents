import type { Point } from '../../lib/geometry';
import type { Rect } from '../../lib/useZoneRects';

/*
 * Keeps the strollers in Base Camp from walking into each other. Every character there
 * commits its plan (a walk, then standing at the end) to one shared Crowd; a new walk is
 * only chosen if it stays clear of everyone else's plan the whole way. Pure geometry plus a
 * small registry, so it is easy to test without a browser.
 */

/** Walk from `from` to `to` over `duration` ms starting at `start`, then stand at `to`. */
export interface Trajectory {
  readonly from: Point;
  readonly to: Point;
  readonly start: number;
  readonly duration: number;
}

/** Gentle start and stop; the animation uses the same curve, so predictions match. */
export function walkEase(u: number): number {
  const t = Math.min(1, Math.max(0, u));
  return t * t * (3 - 2 * t);
}

export function standAt(at: Point, now: number): Trajectory {
  return { from: at, to: at, start: now, duration: 0 };
}

export function positionAt(path: Trajectory, now: number): Point {
  if (path.duration <= 0 || now >= path.start + path.duration) return path.to;
  if (now <= path.start) return path.from;
  const k = walkEase((now - path.start) / path.duration);
  return {
    x: path.from.x + (path.to.x - path.from.x) * k,
    y: path.from.y + (path.to.y - path.from.y) * k,
  };
}

/** Room each character keeps: about a sprite's width across, and its name tag below. */
export const PERSONAL_SPACE = { x: 104, y: 80 } as const;

const STEP_MS = 80;

/**
 * Smallest gap between two plans from `from` on, in personal-space units (below 1 means
 * they bump). After both walks end the two stand still, so checking stops there.
 */
export function clearance(a: Trajectory, b: Trajectory, from: number): number {
  const end = Math.max(from, a.start + a.duration, b.start + b.duration);
  let min = Infinity;
  for (let t = from; ; t += STEP_MS) {
    const now = Math.min(t, end);
    const p = positionAt(a, now);
    const q = positionAt(b, now);
    min = Math.min(min, Math.hypot((p.x - q.x) / PERSONAL_SPACE.x, (p.y - q.y) / PERSONAL_SPACE.y));
    if (now >= end) break;
  }
  return min;
}

/**
 * Two characters already too close (one just landed on the other, say) may still move if
 * they only ever get farther apart and end up clear. Without this they would freeze.
 */
export function separates(a: Trajectory, b: Trajectory, from: number): boolean {
  const end = Math.max(from, a.start + a.duration, b.start + b.duration);
  const gapAt = (now: number): number => {
    const p = positionAt(a, now);
    const q = positionAt(b, now);
    return Math.hypot((p.x - q.x) / PERSONAL_SPACE.x, (p.y - q.y) / PERSONAL_SPACE.y);
  };
  const start = gapAt(from);
  if (start >= 1) return false;
  let previous = start;
  for (let t = from + STEP_MS; ; t += STEP_MS) {
    const now = Math.min(t, end);
    const g = gapAt(now);
    if (g < previous - 0.02) return false;
    previous = Math.max(previous, g);
    if (now >= end) return g >= 1;
  }
}

export class Crowd {
  private readonly paths = new Map<string, Trajectory>();
  private readonly listeners = new Map<string, () => void>();

  get(id: string): Trajectory | undefined {
    return this.paths.get(id);
  }

  /**
   * Commits `id`'s plan. With `notify`, anyone whose plan now runs into it is asked (on the
   * next tick) to step aside.
   */
  set(id: string, path: Trajectory, now: number, notify = true): void {
    this.paths.set(id, path);
    if (!notify) return;
    for (const [other, theirs] of this.paths) {
      if (other === id || clearance(path, theirs, now) >= 1) continue;
      const listener = this.listeners.get(other);
      if (listener !== undefined) setTimeout(listener, 0);
    }
  }

  remove(id: string): void {
    this.paths.delete(id);
  }

  /** Called when someone else's new plan runs into `id`'s. */
  onConflict(id: string, listener: () => void): () => void {
    this.listeners.set(id, listener);
    return () => {
      if (this.listeners.get(id) === listener) this.listeners.delete(id);
    };
  }

  /** Smallest gap between `path` and everyone else's plan, from `now` on. */
  gap(id: string, path: Trajectory, now: number): number {
    let min = Infinity;
    for (const [other, theirs] of this.paths) {
      if (other === id) continue;
      const c = clearance(path, theirs, now);
      // Moving out of a squeeze counts as just clear enough.
      min = Math.min(min, c < 1 && separates(path, theirs, now) ? 1 : c);
    }
    return min;
  }
}

/** Gaps this roomy are taken at once; tighter ones only if nothing better turns up. */
const COMFORTABLE_GAP = 1.25;

/**
 * A walk from `from` to a random spot in `area` that stays clear of everyone, or null if
 * none of `tries` candidates does (the character then waits and tries again).
 */
export function planWalk(
  crowd: Crowd,
  id: string,
  from: Point,
  area: Rect,
  speedPxPerSec: number,
  now: number,
  rand: () => number,
  tries = 24,
): Trajectory | null {
  let best: Trajectory | null = null;
  let bestGap = 1;
  for (let i = 0; i < tries; i++) {
    const to = { x: area.left + rand() * area.width, y: area.top + rand() * area.height };
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    if (distance < 40) continue;
    const duration = Math.min(9_000, Math.max(900, (distance / speedPxPerSec) * 1000));
    const path = { from, to, start: now, duration };
    const gap = crowd.gap(id, path, now);
    if (gap >= COMFORTABLE_GAP) return path;
    if (gap >= bestGap) {
      best = path;
      bestGap = gap;
    }
  }
  return best;
}

/**
 * A spot to land on near `wanted`: `wanted` itself if nobody's plan comes near it, else the
 * closest clear spot found around it inside `area` (or `wanted` when the camp is packed).
 */
export function landingSpot(
  crowd: Crowd,
  id: string,
  wanted: Point,
  area: Rect,
  now: number,
): Point {
  const clear = (p: Point): boolean => crowd.gap(id, standAt(p, now), now) >= 1;
  if (clear(wanted)) return wanted;
  for (let ring = 1; ring <= 6; ring++) {
    const r = ring * 45;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + ring;
      const p = {
        x: Math.min(area.left + area.width, Math.max(area.left, wanted.x + Math.cos(a) * r)),
        y: Math.min(area.top + area.height, Math.max(area.top, wanted.y + Math.sin(a) * r * 0.7)),
      };
      if (clear(p)) return p;
    }
  }
  return wanted;
}
