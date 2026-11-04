import { z } from 'zod';
import { AgentStateSchema } from './domain.js';
import type { AgentState } from './domain.js';

/** Image keys and file names are restricted so they are safe in URLs and paths. */
const KeySchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
const FileSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}\.png$/);

export const SKIN_MODES = ['pixel', 'by-state', 'by-agent'] as const;
export const SkinModeSchema = z.enum(SKIN_MODES);
/**
 * pixel     built-in pixel worker (no images needed)
 * by-state  the image shows the process: one image per state
 * by-agent  each desk keeps a costume; `stateOverrides` (e.g. crying for needs-you) still apply
 */
export type SkinMode = z.infer<typeof SkinModeSchema>;

const ByStateSchema = z.partialRecord(AgentStateSchema, KeySchema);

/**
 * Written by `pnpm skins:import` into ~/.agent-office/skins/<pack>/manifest.json
 * and served by the server at /api/skins.
 */
export const SkinManifestSchema = z
  .object({
    version: z.literal(1),
    name: z.string().min(1).max(60),
    /** Pixel grid of every image (square). */
    size: z.number().int().min(16).max(128),
    images: z.record(KeySchema, FileSchema),
    /** Image per state for "by-state" mode. `idle` is the fallback for missing states. */
    byState: ByStateSchema,
    /** Costumes a desk can wear in "by-agent" mode. */
    costumes: z.array(KeySchema).min(1),
    /** States that use a fixed image even in "by-agent" mode. */
    stateOverrides: ByStateSchema.default({}),
  })
  .superRefine((m, ctx) => {
    const known = new Set(Object.keys(m.images));
    const refs: [string, string][] = [
      ...Object.entries(m.byState).map(([s, k]): [string, string] => [`byState.${s}`, k]),
      ...m.costumes.map((k, i): [string, string] => [`costumes.${i}`, k]),
      ...Object.entries(m.stateOverrides).map(([s, k]): [string, string] => [
        `stateOverrides.${s}`,
        k,
      ]),
    ];
    for (const [where, key] of refs) {
      if (!known.has(key))
        ctx.addIssue({ code: 'custom', message: `${where}: unknown image "${key}"` });
    }
    if (m.byState.idle === undefined) {
      ctx.addIssue({ code: 'custom', message: 'byState.idle is required (fallback)' });
    }
  });
export type SkinManifest = z.infer<typeof SkinManifestSchema>;

export const SkinPackSchema = z.object({
  id: KeySchema,
  manifest: SkinManifestSchema,
});
export type SkinPack = z.infer<typeof SkinPackSchema>;

export const SkinIndexSchema = z.object({ packs: z.array(SkinPackSchema) });
export type SkinIndex = z.infer<typeof SkinIndexSchema>;

/** Which image key a state uses in a given mode. Pure; unit-tested. */
export function skinImageFor(
  manifest: SkinManifest,
  mode: Exclude<SkinMode, 'pixel'>,
  state: AgentState,
  costume: string,
): string {
  if (mode === 'by-agent') {
    return manifest.stateOverrides[state] ?? costume;
  }
  return manifest.byState[state] ?? manifest.byState.idle ?? costume;
}

/** Deterministic default costume for a desk, so a worktree keeps its look across sessions. */
export function defaultCostume(manifest: SkinManifest, desk: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < desk.length; i++) {
    h ^= desk.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  const costume = manifest.costumes[h % manifest.costumes.length];
  // costumes is .min(1), so index 0 always exists.
  return costume ?? manifest.costumes[0] ?? '';
}
