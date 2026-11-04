import { useMediaQuery } from '../../lib/useMediaQuery';

/** Light theme is a sunny day, dark theme is night (stars, lit windows, fireflies). */
export type SceneTheme = 'day' | 'night';

/** Follows the same rule as global.css: `data-theme` on <html> wins, else the system theme. */
export function useSceneTheme(): SceneTheme {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const forced = document.documentElement.dataset.theme;
  if (forced === 'dark') return 'night';
  if (forced === 'light') return 'day';
  return prefersDark ? 'night' : 'day';
}
