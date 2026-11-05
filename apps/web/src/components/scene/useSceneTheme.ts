import { useTheme } from '../../lib/theme';

/** Light theme is a sunny day, dark theme is night (stars, lit windows, fireflies). */
export type SceneTheme = 'day' | 'night';

/** Follows the page theme (the header toggle, else the system). */
export function useSceneTheme(): SceneTheme {
  return useTheme().resolved === 'dark' ? 'night' : 'day';
}
