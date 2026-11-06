import { useEffect } from 'react';
import { BANANA_COLORS, BANANA_ROWS } from '../components/sidebar/BananaLogo';
import { rowsToRuns } from '../components/worker/sprite';
import { tabTitle } from './attention';

type Badge = 'waiting' | 'finished' | null;

/** Pixel marks drawn over the banana's top-left corner, in favicon cells. */
const BADGE_ART: Readonly<Record<Exclude<Badge, null>, { fill: string; mark: string }>> = {
  // "!" on red.
  waiting: {
    fill: '#e5233a',
    mark: "<rect x='0' y='1' width='3' height='5'/><rect x='0' y='7' width='3' height='2'/>",
  },
  // A check on green.
  finished: {
    fill: '#1fb455',
    mark: "<rect x='-2' y='4' width='2' height='2'/><rect x='0' y='6' width='2' height='2'/><rect x='2' y='4' width='2' height='2'/><rect x='4' y='2' width='2' height='2'/>",
  },
};

/** The banana favicon as an SVG data URL, with an optional status badge. */
export function faviconUrl(badge: Badge): string {
  const body = rowsToRuns(BANANA_ROWS)
    .map(
      (r) =>
        `<rect x='${String(r.x)}' y='${String(r.y)}' width='${String(r.w)}' height='1' fill='${BANANA_COLORS[r.key] ?? '#000'}'/>`,
    )
    .join('');
  const mark =
    badge === null
      ? ''
      : `<rect x='-3' y='0' width='10' height='10' fill='${BADGE_ART[badge].fill}'/><g fill='#fff'>${BADGE_ART[badge].mark}</g>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-3 0 22 22' shape-rendering='crispEdges'>${body}${mark}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Puts the waiting count in the tab title and a badge on the favicon. */
export function useTabBadge(waiting: number, finished: number): void {
  useEffect(() => {
    document.title = tabTitle(waiting, finished);
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link === null) return;
    link.href = faviconUrl(waiting > 0 ? 'waiting' : finished > 0 ? 'finished' : null);
  }, [waiting, finished]);
}
