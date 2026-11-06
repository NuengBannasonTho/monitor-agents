import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DesktopPrefsSchema, MAX_HIDDEN_WALKERS } from '@agent-office/shared';
import type { DesktopPatch, DesktopPrefs } from '@agent-office/shared';

export const DEFAULT_DESKTOP_PREFS: DesktopPrefs = { walkers: true, hidden: [] };

/** The choices after a change; hiding an agent again moves it to the newest end. */
export function applyDesktopPatch(prefs: DesktopPrefs, patch: DesktopPatch): DesktopPrefs {
  let hidden = prefs.hidden;
  if (patch.agent !== undefined) {
    const { id } = patch.agent;
    const rest = hidden.filter((h) => h !== id);
    hidden = patch.agent.hidden ? [...rest, id].slice(-MAX_HIDDEN_WALKERS) : rest;
  }
  return { walkers: patch.walkers ?? prefs.walkers, hidden };
}

/** Your desktop app choices from last time; the defaults if none were saved (or unreadable). */
export function loadDesktopPrefs(file: string | undefined): DesktopPrefs {
  if (file === undefined) return DEFAULT_DESKTOP_PREFS;
  try {
    const parsed = DesktopPrefsSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    return parsed.success ? parsed.data : DEFAULT_DESKTOP_PREFS;
  } catch {
    return DEFAULT_DESKTOP_PREFS;
  }
}

/** Saves them for next time; a failure only means they are not remembered. */
export async function saveDesktopPrefs(file: string | undefined, prefs: DesktopPrefs): Promise<void> {
  if (file === undefined) return;
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(prefs, null, 2)}\n`, { mode: 0o600 });
  } catch {
    // Not remembered across restarts; still applied now.
  }
}
