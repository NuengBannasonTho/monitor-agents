import { useEffect } from 'react';
import { markSvg } from '../lib/brand';
import { tabTitle } from './attention';

type Badge = 'waiting' | 'finished' | null;

/** A dot over the mark's top-left corner (64 x 64 units), with a white sign in it. */
const BADGE_ART: Readonly<Record<Exclude<Badge, null>, { fill: string; mark: string }>> = {
  // "!" on red.
  waiting: {
    fill: '#e5233a',
    mark: "<rect x='13' y='5' width='6' height='15' rx='3'/><circle cx='16' cy='25.5' r='3.2'/>",
  },
  // A check on green.
  finished: {
    fill: '#1fb455',
    mark: "<path d='M8 16.5l5.5 5.5 10.5-11' fill='none' stroke='#fff' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/>",
  },
};

/** The app mark as an SVG data URL for the tab, with an optional status badge. */
export function faviconUrl(badge: Badge): string {
  const extra =
    badge === null
      ? ''
      : `<circle cx='16' cy='16' r='16' fill='${BADGE_ART[badge].fill}'/><g fill='#fff'>${BADGE_ART[badge].mark}</g>`;
  return `data:image/svg+xml,${encodeURIComponent(markSvg(extra))}`;
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
