/**
 * Pure merge/unmerge of Agent Office hook entries in Claude Code's settings.json.
 *
 * Works on the parsed JSON without re-shaping it, so key order and every field
 * we do not own survive untouched. Our entries are recognised by a shell
 * comment marker in the command, which still matches if the repo moves.
 */

export const MARKER = '# agent-office-hook';

/** Hook events we subscribe to. PreToolUse needs a matcher; the others match everything. */
export const HOOK_EVENTS: readonly { readonly event: string; readonly matcher?: string }[] = [
  { event: 'SessionStart' },
  { event: 'SessionEnd' },
  { event: 'UserPromptSubmit' },
  { event: 'PreToolUse', matcher: '*' },
  { event: 'PostToolUse', matcher: '*' },
  { event: 'PostToolUseFailure', matcher: '*' },
  { event: 'Notification' },
  { event: 'Stop' },
  { event: 'SubagentStop' },
];

/** Generous for an async hook: emit.sh itself gives up after 0.3 s. */
const HOOK_TIMEOUT_S = 5;

type Json = null | boolean | number | string | Json[] | JsonObject;
export interface JsonObject {
  [key: string]: Json;
}

export class SettingsShapeError extends Error {}

export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** POSIX single-quote escaping, so paths with spaces or quotes are safe. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function hookCommand(emitPath: string): string {
  return `${shellQuote(emitPath)} ${MARKER}`;
}

function isOurHook(hook: Json): boolean {
  return isObject(hook) && typeof hook.command === 'string' && hook.command.includes(MARKER);
}

function groupsFor(hooks: JsonObject, event: string): Json[] {
  const groups = hooks[event];
  if (groups === undefined) return [];
  if (!Array.isArray(groups)) {
    throw new SettingsShapeError(`settings.hooks.${event} should be a list`);
  }
  return groups;
}

/** Removes our hooks from one event's groups; drops groups that only held ours. */
function withoutOurs(groups: readonly Json[]): Json[] {
  const kept: Json[] = [];
  for (const group of groups) {
    if (!isObject(group) || !Array.isArray(group.hooks)) {
      kept.push(group);
      continue;
    }
    const remaining = group.hooks.filter((h) => !isOurHook(h));
    if (remaining.length === group.hooks.length) kept.push(group);
    else if (remaining.length > 0) kept.push({ ...group, hooks: remaining });
  }
  return kept;
}

function readHooks(settings: JsonObject): JsonObject {
  const hooks = settings.hooks;
  if (hooks === undefined) return {};
  if (!isObject(hooks)) throw new SettingsShapeError('settings.hooks should be an object');
  return hooks;
}

/**
 * Adds (or refreshes) our entries. Never touches other hooks. Idempotent:
 * merge(merge(s)) deep-equals merge(s).
 */
export function mergeHooks(settings: JsonObject, emitPath: string): JsonObject {
  const hooks = readHooks(settings);
  const command = hookCommand(emitPath);
  const next: JsonObject = {};

  // Keep existing events in their original order, then append new ones.
  const ours = new Map(HOOK_EVENTS.map((e) => [e.event, e]));
  const order = [
    ...Object.keys(hooks),
    ...HOOK_EVENTS.map((e) => e.event).filter((e) => !(e in hooks)),
  ];
  for (const event of order) {
    const existing = event in hooks ? groupsFor(hooks, event) : [];
    const spec = ours.get(event);
    if (spec === undefined) {
      const value = hooks[event];
      if (value !== undefined) next[event] = value;
      continue;
    }
    const group: JsonObject = {
      ...(spec.matcher === undefined ? {} : { matcher: spec.matcher }),
      hooks: [{ type: 'command', command, async: true, timeout: HOOK_TIMEOUT_S }],
    };
    next[event] = [...withoutOurs(existing), group];
  }
  return { ...settings, hooks: next };
}

/** Removes only our entries; events left empty by that removal are dropped. */
export function unmergeHooks(settings: JsonObject): JsonObject {
  if (settings.hooks === undefined) return settings;
  const hooks = readHooks(settings);
  const next: JsonObject = {};
  for (const event of Object.keys(hooks)) {
    const groups = groupsFor(hooks, event);
    const kept = withoutOurs(groups);
    if (kept.length > 0 || groups.length === 0) next[event] = kept;
  }
  // If only our hooks were there, remove the (now empty) "hooks" key as well.
  if (Object.keys(next).length === 0 && Object.keys(hooks).length > 0) {
    return Object.fromEntries(Object.entries(settings).filter(([key]) => key !== 'hooks'));
  }
  return { ...settings, hooks: next };
}

/** Hook events we want but `settings` has none of ours for (e.g. added in a newer version). */
export function missingHookEvents(settings: JsonObject): string[] {
  const hooks = isObject(settings.hooks) ? settings.hooks : {};
  return HOOK_EVENTS.map((e) => e.event).filter((event) => {
    const groups = hooks[event];
    if (!Array.isArray(groups)) return true;
    return !groups.some((g) => isObject(g) && Array.isArray(g.hooks) && g.hooks.some(isOurHook));
  });
}

export function countOurHooks(settings: JsonObject): number {
  const hooks = isObject(settings.hooks) ? settings.hooks : {};
  let n = 0;
  for (const groups of Object.values(hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const g of groups) {
      if (isObject(g) && Array.isArray(g.hooks)) n += g.hooks.filter(isOurHook).length;
    }
  }
  return n;
}

/** Indentation used by the existing file, so a rewrite does not reformat it. */
export function detectIndent(text: string): string | number {
  const match = /^([ \t]+)"/m.exec(text);
  return match?.[1] ?? 2;
}

export function stringify(settings: JsonObject, indent: string | number): string {
  return `${JSON.stringify(settings, null, indent)}\n`;
}

/** Minimal unified-style line diff (LCS). Settings files are small, so O(n·m) is fine. */
export function lineDiff(before: string, after: string): string[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const row = lcs[i] ?? [];
      row[j] =
        a[i] === b[j]
          ? (lcs[i + 1]?.[j + 1] ?? 0) + 1
          : Math.max(lcs[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push(`  ${a[i] ?? ''}`);
      i++;
      j++;
    } else if (
      i < a.length &&
      (j >= b.length || (lcs[i + 1]?.[j] ?? 0) >= (lcs[i]?.[j + 1] ?? 0))
    ) {
      // Deletions first, like `diff -u`.
      out.push(`- ${a[i] ?? ''}`);
      i++;
    } else {
      out.push(`+ ${b[j] ?? ''}`);
      j++;
    }
  }
  return out;
}

/** Only the changed lines plus `context` lines around them, with "…" for gaps. */
export function compactDiff(lines: readonly string[], context = 2): string[] {
  const changed = lines.map((l) => !l.startsWith('  '));
  const keep = lines.map((_, i) => {
    for (let d = -context; d <= context; d++) if (changed[i + d] === true) return true;
    return false;
  });
  const out: string[] = [];
  let inGap = false;
  lines.forEach((line, i) => {
    if (keep[i] === true) {
      out.push(line);
      inGap = false;
    } else if (!inGap) {
      out.push('  …');
      inGap = true;
    }
  });
  return out;
}
