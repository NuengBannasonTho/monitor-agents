import { SkinIndexSchema, defaultCostume, skinImageFor } from '@agent-office/shared';
import type { AgentState, SkinMode, SkinPack } from '@agent-office/shared';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SkinPrefs } from './prefs';
import { loadPrefs, savePrefs, withCostume, withMode } from './prefs';

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export interface SkinState {
  /** Packs the server offers (empty in the static preview or when none are installed). */
  readonly packs: readonly SkinPack[];
  readonly pack: SkinPack | null;
  /** Effective mode: 'pixel' exactly when no pack is available. */
  readonly mode: SkinMode;
  readonly setMode: (mode: SkinMode) => void;
  readonly setPack: (id: string) => void;
  readonly costumeFor: (desk: string) => string | null;
  readonly setCostume: (desk: string, costume: string | null) => void;
  /** URL of the sprite for this agent right now, or null to draw the pixel worker. */
  readonly spriteFor: (state: AgentState, desk: string) => string | null;
  readonly spriteUrl: (imageKey: string) => string | null;
}

const SkinContext = createContext<SkinState | null>(null);

export function useSkins(): SkinState {
  const ctx = useContext(SkinContext);
  if (ctx === null) throw new Error('useSkins() outside <SkinProvider>');
  return ctx;
}

/** Fetches /api/skins once; failures just mean "no skins". */
function useSkinPacks(enabled: boolean): readonly SkinPack[] {
  const [packs, setPacks] = useState<readonly SkinPack[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch('/api/skins', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: unknown) => {
        const parsed = SkinIndexSchema.safeParse(body);
        if (parsed.success) setPacks(parsed.data.packs);
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
    };
  }, [enabled]);
  return packs;
}

/** Warm the browser cache so state swaps never flash an empty frame. */
function usePreload(pack: SkinPack | null): void {
  useEffect(() => {
    if (pack === null) return;
    for (const file of Object.values(pack.manifest.images)) {
      const img = new Image();
      img.src = `/skins/${pack.id}/${file}`;
    }
  }, [pack]);
}

export function SkinProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const packs = useSkinPacks(enabled);
  const [prefs, setPrefs] = useState<SkinPrefs>(() => loadPrefs(safeStorage()));

  const update = useCallback((next: (p: SkinPrefs) => SkinPrefs) => {
    setPrefs((current) => {
      const value = next(current);
      savePrefs(safeStorage(), value);
      return value;
    });
  }, []);

  const pack = packs.find((p) => p.id === prefs.packId) ?? packs[0] ?? null;
  // Pixel workers are only the fallback for when no pack is installed; a "Pixel" choice
  // remembered from an older version shows the pack by task instead.
  const mode: SkinMode = pack === null ? 'pixel' : prefs.mode === 'pixel' ? 'by-state' : prefs.mode;
  usePreload(pack);

  const value = useMemo<SkinState>(() => {
    const spriteUrl = (key: string): string | null => {
      const file = pack?.manifest.images[key];
      return pack === null || file === undefined ? null : `/skins/${pack.id}/${file}`;
    };
    const costumeFor = (desk: string): string | null => {
      if (pack === null) return null;
      const chosen = prefs.costumeByDesk[desk];
      return chosen !== undefined && pack.manifest.costumes.includes(chosen)
        ? chosen
        : defaultCostume(pack.manifest, desk);
    };
    return {
      packs,
      pack,
      mode,
      setMode: (m) => {
        update((p) => withMode(p, m));
      },
      setPack: (id) => {
        update((p) => ({ ...p, packId: id }));
      },
      costumeFor,
      setCostume: (desk, costume) => {
        update((p) => withCostume(p, desk, costume));
      },
      spriteUrl,
      spriteFor: (state, desk) => {
        if (pack === null || mode === 'pixel') return null;
        const costume = costumeFor(desk) ?? '';
        return spriteUrl(skinImageFor(pack.manifest, mode, state, costume));
      },
    };
  }, [packs, pack, mode, prefs.costumeByDesk, update]);

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>;
}
