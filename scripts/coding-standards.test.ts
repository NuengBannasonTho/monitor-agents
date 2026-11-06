import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * The coding standard's file rules, checked on every test run: kebab-case files and folders,
 * the web app's api/<topic>/<topic>.(services|hooks|models).ts, a page.tsx per page folder
 * and types/<topic>/<topic>.types.ts.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIRS = [
  'apps/web/src',
  'apps/server/src',
  'apps/desktop/src',
  'packages/shared/src',
  'scripts',
] as const;
const WEB = 'apps/web/src';

/** "user-profile", "use-agent-stream", "v2": lowercase words joined by dashes. */
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) return [];
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? [full, ...walk(full)] : [full];
  });
}

/** Every file and folder under the source dirs, relative to the repo. */
function entries(): string[] {
  return SOURCE_DIRS.flatMap((dir) => walk(path.join(ROOT, dir))).map((full) =>
    path.relative(ROOT, full),
  );
}

/** "user.services.ts" -> "user"; "env.d.ts" -> "env"; a folder keeps its name. */
const stemOf = (name: string): string => name.split('.')[0] ?? name;

describe('coding standards', () => {
  it('names files and folders in kebab-case', () => {
    const wrong = entries().filter((entry) => !KEBAB.test(stemOf(path.basename(entry))));
    expect(wrong).toEqual([]);
  });

  it('keeps api/<topic>/ files named <topic>.services|hooks|models.ts', () => {
    const api = path.join(ROOT, WEB, 'api');
    const wrong = readdirSync(api).flatMap((topic) =>
      readdirSync(path.join(api, topic))
        .filter((file) => !new RegExp(`^${topic}\\.(services|hooks|models)\\.ts$`).test(file))
        .map((file) => `${topic}/${file}`),
    );
    expect(wrong).toEqual([]);
  });

  it('gives every page folder a page.tsx', () => {
    const pages = path.join(ROOT, WEB, 'pages');
    const missing = readdirSync(pages).filter(
      (page) => !readdirSync(path.join(pages, page)).includes('page.tsx'),
    );
    expect(missing).toEqual([]);
  });

  it('keeps types/<topic>/ files named <topic>.types.ts', () => {
    const types = path.join(ROOT, WEB, 'types');
    const wrong = readdirSync(types).flatMap((topic) =>
      readdirSync(path.join(types, topic))
        .filter((file) => file !== `${topic}.types.ts`)
        .map((file) => `${topic}/${file}`),
    );
    expect(wrong).toEqual([]);
  });
});
