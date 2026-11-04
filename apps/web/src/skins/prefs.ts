import { SkinModeSchema } from '@agent-office/shared';
import type { SkinMode } from '@agent-office/shared';
import { z } from 'zod';

const STORAGE_KEY = 'agent-office:skin-prefs:v1';

export const SkinPrefsSchema = z.object({
  mode: SkinModeSchema.default('by-state'),
  packId: z.string().nullable().default(null),
  /** Costume chosen per desk (worktree name), so it survives new sessions. */
  costumeByDesk: z.record(z.string(), z.string()).default({}),
});
export type SkinPrefs = z.infer<typeof SkinPrefsSchema>;

export const DEFAULT_PREFS: SkinPrefs = { mode: 'by-state', packId: null, costumeByDesk: {} };

/** Browser storage can be missing, blocked or throw; preferences are only a convenience. */
export function loadPrefs(storage: Pick<Storage, 'getItem'> | undefined): SkinPrefs {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (raw == null) return DEFAULT_PREFS;
    const parsed = SkinPrefsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(storage: Pick<Storage, 'setItem'> | undefined, prefs: SkinPrefs): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Quota exceeded or storage disabled: keep the in-memory preference only.
  }
}

export function withMode(prefs: SkinPrefs, mode: SkinMode): SkinPrefs {
  return { ...prefs, mode };
}

export function withCostume(prefs: SkinPrefs, desk: string, costume: string | null): SkinPrefs {
  const rest = Object.fromEntries(Object.entries(prefs.costumeByDesk).filter(([d]) => d !== desk));
  return { ...prefs, costumeByDesk: costume === null ? rest : { ...rest, [desk]: costume } };
}
