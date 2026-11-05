import type { ResolvedTheme } from '../../lib/theme';
import { setThemeChoice, useTheme } from '../../lib/theme';
import { DarkModeIcon, LightModeIcon } from '../icons';
import type { TabOption } from './Tabs';
import { Tabs } from './Tabs';

const OPTIONS: readonly TabOption<ResolvedTheme>[] = [
  { value: 'light', label: 'Light', hint: 'Light mode: daytime scenes', icon: <LightModeIcon /> },
  { value: 'dark', label: 'Dark', hint: 'Dark mode: night scenes', icon: <DarkModeIcon /> },
];

/** Light or dark, remembered in this browser (the system theme until you pick one). */
export function ThemeSwitcher() {
  const { resolved } = useTheme();
  return <Tabs options={OPTIONS} value={resolved} onChange={setThemeChoice} label="Theme" />;
}
