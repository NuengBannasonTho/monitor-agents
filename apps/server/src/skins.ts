import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { SkinManifestSchema } from '@agent-office/shared';
import type { SkinPack } from '@agent-office/shared';

const PACK_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

/**
 * Lists skin packs under `skinsDir` (one folder per pack, each with a
 * manifest.json written by `pnpm skins:import`). Invalid packs are skipped.
 */
export async function listSkinPacks(
  skinsDir: string,
  onInvalid: (id: string, reason: string) => void = () => undefined,
): Promise<SkinPack[]> {
  let entries: string[];
  try {
    entries = (await readdir(skinsDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && PACK_ID.test(e.name))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }

  const packs: SkinPack[] = [];
  for (const id of entries) {
    try {
      const raw: unknown = JSON.parse(
        await readFile(path.join(skinsDir, id, 'manifest.json'), 'utf8'),
      );
      const parsed = SkinManifestSchema.safeParse(raw);
      if (parsed.success) packs.push({ id, manifest: parsed.data });
      else onInvalid(id, parsed.error.message);
    } catch (error) {
      onInvalid(id, error instanceof Error ? error.message : String(error));
    }
  }
  return packs;
}
