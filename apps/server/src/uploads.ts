import { randomBytes } from 'node:crypto';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SendFile } from '@agent-office/shared';
import { MAX_SEND_FILE_BYTES } from '@agent-office/shared';

/*
 * Files you attach in an agent's drawer. They are saved outside your projects (so no
 * worktree gets stray files) and the message points the agent at them with `@path`, the
 * way Claude Code takes files and images in a prompt. Old ones are cleared after a week.
 */

/** Uploads older than this are deleted when the server starts. */
export const UPLOAD_MAX_AGE_MS = 7 * 24 * 60 * 60_000;

/** A file name that is safe on disk and in an `@path` (no folders, spaces or odd bytes). */
export function safeFileName(name: string): string {
  const base = path.basename(name.replace(/\\/g, '/'));
  const cleaned = base
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^[.-]+/, '')
    .replace(/-+/g, '-')
    .slice(-100);
  return cleaned === '' ? 'file' : cleaned;
}

/** A file over the size limit, or an empty one; app.ts answers 413. */
export class UploadTooLarge extends Error {
  readonly code = 'too-large';

  constructor(message: string) {
    super(message);
    this.name = 'UploadTooLarge';
  }
}

/**
 * Saves the files in a folder of their own and returns their absolute paths, in order.
 * Throws UploadTooLarge if one is over the limit (nothing is kept then).
 */
export async function saveUploads(
  root: string,
  agentId: string,
  files: readonly SendFile[],
  now: Date = new Date(),
): Promise<string[]> {
  const decoded = files.map((f) => ({
    name: safeFileName(f.name),
    bytes: Buffer.from(f.data, 'base64'),
  }));
  if (decoded.some((f) => f.bytes.length === 0 || f.bytes.length > MAX_SEND_FILE_BYTES)) {
    throw new UploadTooLarge('file too large or empty');
  }
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const dir = path.join(root, safeFileName(agentId), `${stamp}-${randomBytes(3).toString('hex')}`);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const used = new Set<string>();
  const paths: string[] = [];
  for (const file of decoded) {
    // Two files with one name: keep both.
    let name = file.name;
    for (let n = 2; used.has(name); n++) {
      const ext = path.extname(file.name);
      name = `${path.basename(file.name, ext)}-${String(n)}${ext}`;
    }
    used.add(name);
    const target = path.join(dir, name);
    await writeFile(target, file.bytes, { mode: 0o600 });
    paths.push(target);
  }
  return paths;
}

/** The message as typed into the terminal: your text, then `@path` for each file. */
export function messageWithFiles(text: string, paths: readonly string[]): string {
  if (paths.length === 0) return text;
  const refs = paths.map((p) => `@${p}`).join(' ');
  return text === ''
    ? `Have a look at ${paths.length === 1 ? 'this file' : 'these files'}: ${refs}`
    : `${text}\n\n${refs}`;
}

/** Deletes upload folders older than the limit; quietly, it is only housekeeping. */
export async function pruneUploads(root: string, now: number = Date.now()): Promise<void> {
  let agents: string[];
  try {
    agents = await readdir(root);
  } catch {
    return;
  }
  for (const agent of agents) {
    const agentDir = path.join(root, agent);
    let batches: string[];
    try {
      batches = await readdir(agentDir);
    } catch {
      continue;
    }
    for (const batch of batches) {
      const dir = path.join(agentDir, batch);
      try {
        if (now - (await stat(dir)).mtimeMs > UPLOAD_MAX_AGE_MS) {
          await rm(dir, { recursive: true, force: true });
        }
      } catch {
        // Gone already, or not ours to read: leave it.
      }
    }
  }
}
