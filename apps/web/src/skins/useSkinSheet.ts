import { useEffect, useSyncExternalStore } from 'react';
import { SKIN_FRAMES, buildSkinFrames, skinEffectFor } from './skinMotion';

/** A horizontal strip of animation frames for one skin image. */
export interface SkinSheet {
  readonly url: string;
  readonly frames: number;
}

const ready = new Map<string, SkinSheet | null>();
const pending = new Map<string, Promise<SkinSheet | null>>();

async function buildSheet(src: string): Promise<SkinSheet | null> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const size = img.naturalWidth;
  if (size === 0 || img.naturalHeight !== size) return null;

  const still = document.createElement('canvas');
  still.width = size;
  still.height = size;
  const stillCtx = still.getContext('2d', { willReadFrequently: true });
  if (stillCtx === null) return null;
  stillCtx.drawImage(img, 0, 0);
  const pixels = stillCtx.getImageData(0, 0, size, size).data;

  const name =
    src
      .split('/')
      .pop()
      ?.replace(/\.png$/i, '') ?? '';
  const frames = buildSkinFrames(pixels, size, skinEffectFor(name), SKIN_FRAMES);

  const sheet = document.createElement('canvas');
  sheet.width = size * frames.length;
  sheet.height = size;
  const sheetCtx = sheet.getContext('2d');
  if (sheetCtx === null) return null;
  frames.forEach((frame, i) => {
    sheetCtx.putImageData(new ImageData(new Uint8ClampedArray(frame), size, size), i * size, 0);
  });
  const blob = await new Promise<Blob | null>((resolve) => {
    sheet.toBlob(resolve, 'image/png');
  });
  // Kept for the whole session: every agent wearing this image shares the strip.
  return blob === null ? null : { url: URL.createObjectURL(blob), frames: frames.length };
}

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function load(src: string): void {
  if (pending.has(src)) return;
  pending.set(
    src,
    buildSheet(src)
      .catch(() => null)
      .then((sheet) => {
        ready.set(src, sheet);
        for (const notify of listeners) notify();
        return sheet;
      }),
  );
}

/**
 * Animation strip for a skin image, or null until it is built (and if building fails),
 * in which case callers show the still image.
 */
export function useSkinSheet(src: string): SkinSheet | null {
  const sheet = useSyncExternalStore(
    subscribe,
    () => ready.get(src) ?? null,
    () => null,
  );
  useEffect(() => {
    load(src);
  }, [src]);
  return sheet;
}
