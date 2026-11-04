import type { RefObject } from 'react';
import { useLayoutEffect, useState } from 'react';

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

/** Measures both zones relative to the office container and tracks resizes. */
export function useZoneRects(
  officeRef: RefObject<HTMLElement | null>,
  loungeRef: RefObject<HTMLElement | null>,
  tableRef: RefObject<HTMLElement | null>,
): ZoneRects | null {
  const [rects, setRects] = useState<ZoneRects | null>(null);

  useLayoutEffect(() => {
    const office = officeRef.current;
    const lounge = loungeRef.current;
    const table = tableRef.current;
    if (office === null || lounge === null || table === null) return;

    const measure = (): void => {
      const next: ZoneRects = {
        lounge: relativeRect(lounge, office),
        table: relativeRect(table, office),
      };
      setRects((prev) =>
        prev !== null && sameRect(prev.lounge, next.lounge) && sameRect(prev.table, next.table)
          ? prev
          : next,
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(office);
    observer.observe(lounge);
    observer.observe(table);
    return () => {
      observer.disconnect();
    };
  }, [officeRef, loungeRef, tableRef]);

  return rects;
}
