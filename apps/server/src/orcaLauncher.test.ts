import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { orcaLauncher, reposFrom, worktreesFrom } from './orcaLauncher.js';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'orca-launcher-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** A stand-in for Orca's CLI: logs its arguments (one per line) and replies with `reply`. */
async function fakeOrca(reply: string): Promise<string> {
  const bin = path.join(dir, 'orca');
  await writeFile(
    bin,
    `#!/bin/sh\nfor a in "$@"; do printf '%s\\n' "$a"; done >> "${dir}/args"\nprintf '%s' '${reply}'\n`,
  );
  await chmod(bin, 0o755);
  return bin;
}

describe("reading Orca's lists", () => {
  it('keeps repos and live worktrees, branch names without refs/heads', () => {
    expect(
      reposFrom({
        ok: true,
        result: {
          repos: [{ id: 'r1', path: '/code/app', displayName: 'app' }, { id: 'r2' }],
        },
      }),
    ).toEqual([{ id: 'r1', path: '/code/app', name: 'app' }]);
    expect(
      worktreesFrom({
        ok: true,
        result: {
          worktrees: [
            {
              id: 'r1::/code/app',
              repoId: 'r1',
              path: '/code/app',
              branch: 'refs/heads/main',
              displayName: 'main',
              isMainWorktree: true,
            },
            { id: 'old', repoId: 'r1', path: '/code/old', isArchived: true },
          ],
        },
      }),
    ).toEqual([
      {
        id: 'r1::/code/app',
        repoId: 'r1',
        path: '/code/app',
        branch: 'main',
        name: 'main',
        main: true,
      },
    ]);
    expect(reposFrom(null)).toEqual([]);
  });
});

describe('starting Claude Code through Orca', () => {
  it('creates a worktree with the agent, the prompt kept whole even if it looks like a flag', async () => {
    const launcher = orcaLauncher(await fakeOrca('{"ok":true,"result":{}}'));
    expect(await launcher.startInNewWorktree('r1', 'fix-login', '--help me\nplease')).toEqual({
      ok: true,
    });
    const args = await readFile(path.join(dir, 'args'), 'utf8');
    expect(args).toBe(
      [
        'worktree',
        'create',
        '--repo=id:r1',
        '--name=fix-login',
        '--no-parent',
        '--agent=claude',
        '--surface=terminal',
        '--prompt=--help me',
        'please',
        '--json',
        '',
      ].join('\n'),
    );
  });

  it('launches Codex when selected', async () => {
    const launcher = orcaLauncher(await fakeOrca('{"ok":true,"result":{}}'));
    expect(await launcher.startInWorktree('w1', 'Investigate', 'codex')).toEqual({ ok: true });
    const args = await readFile(path.join(dir, 'args'), 'utf8');
    expect(args).toContain('--agent=codex\n');
  });

  it("passes Orca's refusal on, and says when Orca is not there", async () => {
    const refusing = orcaLauncher(
      await fakeOrca('{"ok":false,"error":{"code":"worktree_exists","message":"worktree_exists"}}'),
    );
    expect(await refusing.startInWorktree('w1', 'go')).toEqual({
      ok: false,
      error: 'Orca: worktree exists',
    });
    const missing = orcaLauncher(path.join(dir, 'no-such-orca'));
    expect((await missing.startInWorktree('w1', 'go')).ok).toBe(false);
    expect(await missing.places()).toBeNull();
  });
});
