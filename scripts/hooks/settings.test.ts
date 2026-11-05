import { describe, expect, it } from 'vitest';
import type { JsonObject } from './settings.js';
import {
  HOOK_EVENTS,
  MARKER,
  SettingsShapeError,
  compactDiff,
  countOurHooks,
  detectIndent,
  hookCommand,
  lineDiff,
  mergeHooks,
  missingHookEvents,
  shellQuote,
  unmergeHooks,
} from './settings.js';

const EMIT = '/Users/me/code/agent office/scripts/emit.sh';

const existing: JsonObject = {
  model: 'opus',
  permissions: { allow: ['Bash(pnpm test)'] },
  hooks: {
    PreToolUse: [
      { matcher: 'Bash', hooks: [{ type: 'command', command: '/usr/local/bin/guard.sh' }] },
    ],
    PostToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'prettier --write' }] }],
  },
  statusLine: { type: 'command', command: 'echo hi' },
};

describe('mergeHooks', () => {
  it('adds one async hook per event, with matcher "*" on PreToolUse only', () => {
    const merged = mergeHooks({}, EMIT);
    expect(countOurHooks(merged)).toBe(HOOK_EVENTS.length);
    const hooks = merged.hooks as Record<
      string,
      { matcher?: string; hooks: { async: boolean }[] }[]
    >;
    expect(hooks.PreToolUse?.[0]?.matcher).toBe('*');
    expect(hooks.Stop?.[0]?.matcher).toBeUndefined();
    expect(hooks.Stop?.[0]?.hooks[0]?.async).toBe(true);
  });

  it('is idempotent', () => {
    const once = mergeHooks(existing, EMIT);
    expect(mergeHooks(once, EMIT)).toEqual(once);
    expect(countOurHooks(mergeHooks(once, EMIT))).toBe(HOOK_EVENTS.length);
  });

  it('never removes or changes existing hooks or other settings', () => {
    const merged = mergeHooks(existing, EMIT);
    expect(merged.model).toBe('opus');
    expect(merged.statusLine).toEqual(existing.statusLine);
    const hooks = merged.hooks as Record<string, unknown[]>;
    expect(hooks.PreToolUse?.[0]).toEqual(
      (existing.hooks as Record<string, unknown[]>).PreToolUse?.[0],
    );
    // The user's own PostToolUse hooks stay first and untouched; ours is appended.
    const theirs = (existing.hooks as Record<string, unknown[]>).PostToolUse ?? [];
    expect(hooks.PostToolUse?.slice(0, theirs.length)).toEqual(theirs);
    expect(hooks.PostToolUse).toHaveLength(theirs.length + 1);
  });

  it('lists hook events added since the last install', () => {
    const merged = mergeHooks({}, EMIT);
    expect(missingHookEvents(merged)).toEqual([]);
    const hooks = { ...(merged.hooks as Record<string, unknown>) };
    delete hooks.PostToolUse;
    delete hooks.PostToolUseFailure;
    expect(missingHookEvents({ hooks: hooks as JsonObject })).toEqual([
      'PostToolUse',
      'PostToolUseFailure',
    ]);
  });

  it('keeps the original key order', () => {
    const merged = mergeHooks(existing, EMIT);
    expect(Object.keys(merged)).toEqual(['model', 'permissions', 'hooks', 'statusLine']);
    expect(Object.keys(merged.hooks as object).slice(0, 2)).toEqual(['PreToolUse', 'PostToolUse']);
  });

  it('refreshes our entry when the repo has moved', () => {
    const old = mergeHooks(existing, '/old/place/scripts/emit.sh');
    const moved = mergeHooks(old, EMIT);
    expect(countOurHooks(moved)).toBe(HOOK_EVENTS.length);
    expect(JSON.stringify(moved)).not.toContain('/old/place');
  });

  it('quotes paths with spaces and quotes', () => {
    expect(shellQuote("/a b/it's/emit.sh")).toBe("'/a b/it'\\''s/emit.sh'");
    expect(hookCommand(EMIT)).toBe(`'${EMIT}' ${MARKER}`);
  });

  it('refuses a malformed hooks section instead of guessing', () => {
    expect(() => mergeHooks({ hooks: [] }, EMIT)).toThrow(SettingsShapeError);
    expect(() => mergeHooks({ hooks: { Stop: 'nope' } }, EMIT)).toThrow(SettingsShapeError);
  });
});

describe('unmergeHooks', () => {
  it('restores the original settings exactly', () => {
    expect(unmergeHooks(mergeHooks(existing, EMIT))).toEqual(existing);
    expect(unmergeHooks(mergeHooks({ model: 'x' }, EMIT))).toEqual({ model: 'x' });
  });

  it('removes only our hook from a group the user shares with us', () => {
    const shared: JsonObject = {
      hooks: {
        Stop: [
          {
            hooks: [
              { type: 'command', command: 'say done' },
              { type: 'command', command: hookCommand(EMIT) },
            ],
          },
        ],
      },
    };
    expect(unmergeHooks(shared)).toEqual({
      hooks: { Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }] },
    });
  });

  it('is a no-op without our hooks', () => {
    expect(unmergeHooks(existing)).toEqual(existing);
    expect(unmergeHooks({})).toEqual({});
  });
});

describe('diff helpers', () => {
  it('detects indentation', () => {
    expect(detectIndent('{\n    "a": 1\n}')).toBe('    ');
    expect(detectIndent('{\n\t"a": 1\n}')).toBe('\t');
    expect(detectIndent('{}')).toBe(2);
  });

  it('marks added and removed lines', () => {
    expect(lineDiff('a\nb\nc', 'a\nx\nc')).toEqual(['  a', '- b', '+ x', '  c']);
  });

  it('collapses unchanged runs', () => {
    const lines = lineDiff('1\n2\n3\n4\n5\n6\n7\n8', '1\n2\n3\n4\n5\n6\n7\nX');
    expect(compactDiff(lines, 1)).toEqual(['  …', '  7', '- 8', '+ X']);
  });
});
