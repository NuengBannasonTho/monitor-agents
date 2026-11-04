import { randomBytes, timingSafeEqual } from 'node:crypto';
import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const TOKEN_FILE = 'token';
/** curl header file derived from the token; emit.sh reads it with `-H @file`. */
export const CURL_HEADERS_FILE = 'curl-headers';

function isNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

async function writePrivate(file: string, content: string): Promise<void> {
  // The mode option only applies on create; chmod covers files that already existed.
  await writeFile(file, content, { mode: 0o600 });
  await chmod(file, 0o600);
}

async function readToken(file: string): Promise<string | null> {
  try {
    const token = (await readFile(file, 'utf8')).trim();
    if (!/^[0-9a-f]{32,}$/i.test(token)) return null;
    const { mode } = await stat(file);
    if ((mode & 0o077) !== 0) await chmod(file, 0o600);
    return token;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/**
 * Reads ~/.agent-office/token, creating it (0600, directory 0700) on first run,
 * and keeps the curl header file used by emit.sh in sync with it.
 */
export async function ensureToken(homeDir: string): Promise<string> {
  await mkdir(homeDir, { recursive: true, mode: 0o700 });
  const tokenFile = path.join(homeDir, TOKEN_FILE);
  let token = await readToken(tokenFile);
  if (token === null) {
    token = randomBytes(32).toString('hex');
    await writePrivate(tokenFile, `${token}\n`);
  }
  await writePrivate(path.join(homeDir, CURL_HEADERS_FILE), `X-Token: ${token}\n`);
  return token;
}

/** Constant-time comparison that does not leak the token length via early exit. */
export function tokenMatches(expected: string, provided: string | undefined): boolean {
  if (provided === undefined) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}
