/**
 * pnpm skins:import <folder> [--pack <id>] [--size 64] [--out ~/.agent-office/skins]
 *
 * Turns a folder of character images plus a skin.json into a pixel-art skin
 * pack the app can load. Images are processed together so every frame of a
 * pack shares one crop and one scale (characters do not jump when swapping).
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { SkinManifestSchema } from '@agent-office/shared';
import sharp from 'sharp';
import { z } from 'zod';
import type { Box } from './pixelate.js';
import {
  cropWithPadding,
  opaqueBounds,
  removeBackground,
  squareAround,
  thresholdAlpha,
  unionBox,
} from './pixelate.js';

const SourceSchema = z.object({
  name: z.string().min(1),
  size: z.number().int().min(16).max(128).optional(),
  images: z.record(z.string(), z.string().min(1)),
  byState: z.record(z.string(), z.string()),
  costumes: z.array(z.string()).min(1),
  stateOverrides: z.record(z.string(), z.string()).optional(),
});

const MAX_COLORS = 48;

interface Loaded {
  readonly key: string;
  readonly rgba: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly bounds: Box;
}

async function load(key: string, file: string): Promise<Loaded> {
  // Normalise every input (16-bit, greyscale, CMYK, palette, rotated) to 8-bit sRGB + alpha.
  const { data, info } = await sharp(file)
    .rotate()
    .toColourspace('srgb')
    .ensureAlpha()
    .raw({ depth: 'uchar' })
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 4 || data.length !== info.width * info.height * 4) {
    throw new Error(`${file}: unexpected pixel format (${info.channels} channels)`);
  }
  const rgba = removeBackground(new Uint8Array(data), info.width, info.height);
  const bounds = opaqueBounds(rgba, info.width, info.height);
  if (bounds === null) throw new Error(`${file}: nothing left after removing the background`);
  return { key, rgba, width: info.width, height: info.height, bounds };
}

async function pixelate(img: Loaded, crop: Box, size: number): Promise<Buffer> {
  const side = crop.right - crop.left;
  const cropped = cropWithPadding(img.rgba, img.width, img.height, crop);

  // Area-average down to the grid, then snap alpha and colors to a small palette.
  const small = await sharp(cropped, { raw: { width: side, height: side, channels: 4 } })
    .resize(size, size, { kernel: 'lanczos3' })
    // Averaging dulls flat pixel-art colors; win a little back.
    .modulate({ saturation: 1.12 })
    .raw()
    .toBuffer();
  const hard = thresholdAlpha(new Uint8Array(small));
  return sharp(hard, { raw: { width: size, height: size, channels: 4 } })
    .png({ palette: true, colours: MAX_COLORS, dither: 0, compressionLevel: 9 })
    .toBuffer();
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      pack: { type: 'string' },
      size: { type: 'string' },
      out: { type: 'string', default: path.join(os.homedir(), '.agent-office', 'skins') },
    },
  });
  const srcDir = positionals[0];
  if (srcDir === undefined) {
    throw new Error(
      'usage: pnpm skins:import <folder with images + skin.json> [--pack id] [--size 64]',
    );
  }

  const source = SourceSchema.parse(
    JSON.parse(await readFile(path.join(srcDir, 'skin.json'), 'utf8')),
  );
  const packId = slug(values.pack ?? source.name);
  const size = values.size === undefined ? (source.size ?? 64) : Number.parseInt(values.size, 10);
  const outDir = path.join(values.out, packId);

  const keys = Object.keys(source.images).map((k) => ({ raw: k, key: slug(k) }));
  const loaded = await Promise.all(
    keys.map(({ raw, key }) => {
      const file = source.images[raw];
      if (file === undefined) throw new Error(`missing image for ${raw}`);
      return load(key, path.join(srcDir, file));
    }),
  );
  const union = unionBox(loaded.map((l) => l.bounds));
  if (union === null) throw new Error('no images');
  const crop = squareAround(union);

  const manifest = SkinManifestSchema.parse({
    version: 1,
    name: source.name,
    size,
    images: Object.fromEntries(loaded.map((l) => [l.key, `${l.key}.png`])),
    byState: Object.fromEntries(Object.entries(source.byState).map(([s, k]) => [s, slug(k)])),
    costumes: source.costumes.map(slug),
    stateOverrides: Object.fromEntries(
      Object.entries(source.stateOverrides ?? {}).map(([s, k]) => [s, slug(k)]),
    ),
  });

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  for (const img of loaded) {
    await writeFile(path.join(outDir, `${img.key}.png`), await pixelate(img, crop, size));
  }
  await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${loaded.length} sprites (${size}×${size}) to ${outDir}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
