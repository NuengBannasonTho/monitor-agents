/*
 * Narrowing what comes in from outside (JSON, files, errors) instead of casting it.
 */

/** A plain object (not null, not an array) whose keys can be read. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The `code` of a Node.js system error (EEXIST, EXDEV…), when it has one. */
export function errnoCode(error: unknown): string | undefined {
  return isRecord(error) && typeof error.code === 'string' ? error.code : undefined;
}

/** A string field of a JSON object, such as a server's `{ "error": "…" }`; null otherwise. */
export function stringField(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  const field = value[key];
  return typeof field === 'string' ? field : null;
}
