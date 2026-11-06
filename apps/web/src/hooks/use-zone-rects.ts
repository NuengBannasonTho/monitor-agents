import type { RefObject } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface ZoneRects {
  readonly lounge: Rect;
  readonly table: Rect;
}

function relativeRect(el: HTMLElement, origin: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  const o = origin.getBoundingClientRect();
  return { left: r.left - o.left, top: r.top - o.top, width: r.width, height: r.height };
}

function sameRect(a: Rect, b: Rect): boolean {
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

export interface ZoneLayout {
  readonly rects: ZoneRects | null;
  /**
   * True for a moment after the zones changed size (window resize, a panel collapsing), so
   * characters can jump to their new spots instead of flying across the scene.
   */
  readonly settling: boolean;
}

/** How long after a resize characters keep jumping rather than flying. */
const SETTLE_MS = 200;

/**
 * Measures both zones relative to the office container and tracks resizes. While `frozen`
 * (a panel is animating open or shut) sizes are not followed; they are measured once when
 * it ends, so the scenes repaint once instead of on every animation frame.
 */
export function useZoneRects(
  officeRef: RefObject<HTMLElement | null>,
  loungeRef: RefObject<HTMLElement | null>,
  tableRef: RefObject<HTMLElement | null>,
  frozen = false,
): ZoneLayout {
  const [state, setState] = useState<{ rects: ZoneRects | null; version: number }>({
    rects: null,
    version: 0,
  });
  const [settled, setSettled] = useState(0);
  const frozenRef = useRef(frozen);
  const measureRef = useRef<() => void>(() => undefined);

  useLayoutEffect(() => {
    const office = officeRef.current;
    const lounge = loungeRef.current;
    const table = tableRef.current;
    if (office === null || lounge === null || table === null) return;

    const measure = (): void => {
      if (frozenRef.current) return;
      const next: ZoneRects = {
        lounge: relativeRect(lounge, office),
        table: relativeRect(table, office),
      };
      setState((prev) =>
        prev.rects !== null &&
        sameRect(prev.rects.lounge, next.lounge) &&
        sameRect(prev.rects.table, next.table)
          ? prev
          : { rects: next, version: prev.version + 1 },
      );
    };
    measureRef.current = measure;

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(office);
    observer.observe(lounge);
    observer.observe(table);
    return () => {
      observer.disconnect();
    };
  }, [officeRef, loungeRef, tableRef]);

  // Thawing: catch up with whatever size the zones ended at.
  useLayoutEffect(() => {
    frozenRef.current = frozen;
    if (!frozen) measureRef.current();
  }, [frozen]);

  useEffect(() => {
    if (state.version === settled) return;
    const timer = setTimeout(() => {
      setSettled(state.version);
    }, SETTLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [state.version, settled]);

  return { rects: state.rects, settling: state.version !== settled };
}
