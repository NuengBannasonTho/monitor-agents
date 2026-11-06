import type { OrcaRepo, OrcaWorktree } from '@agent-office/shared';
import { defaultOrcaBin, record, runOrca } from './orcaTerminal.js';

/*
 * Starting Claude Code from the dashboard, through Orca's CLI: in a new worktree
 * (`orca worktree create --agent claude`) or in one Orca already has (`orca agent launch`).
 * Always as a terminal, so the agent reports through the hooks and you can type to it.
 */

export interface Places {
  readonly repos: readonly OrcaRepo[];
  readonly worktrees: readonly OrcaWorktree[];
}

export type LaunchResult = { readonly ok: true } | { readonly ok: false; readonly error: string };
export type LaunchProvider = 'claude' | 'codex';

export interface AgentLauncher {
  /** Repos and worktrees Orca knows; null when Orca does not answer. */
  places(): Promise<Places | null>;
  /** A new worktree (and branch) of the repo, with Claude Code started on the prompt. */
  startInNewWorktree(
    repoId: string,
    name: string,
    prompt: string,
    provider?: LaunchProvider,
  ): Promise<LaunchResult>;
  /** Claude Code started on the prompt in an existing worktree. */
  startInWorktree(
    worktreeId: string,
    prompt: string,
    provider?: LaunchProvider,
  ): Promise<LaunchResult>;
}

/** Reading Orca's lists is quick; creating a worktree can run the repo's setup first. */
const LIST_TIMEOUT_MS = 10_000;
const LAUNCH_TIMEOUT_MS = 120_000;

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

export function reposFrom(reply: unknown): OrcaRepo[] {
  const repos = record(record(reply).result).repos;
  if (!Array.isArray(repos)) return [];
  return repos.flatMap((raw) => {
    const repo = record(raw);
    const id = text(repo.id);
    const path = text(repo.path);
    if (id === null || path === null) return [];
    return [
      {
        id,
        path,
        name: text(repo.displayName) ?? path.split('/').pop() ?? path,
      },
    ];
  });
}

export function worktreesFrom(reply: unknown): OrcaWorktree[] {
  const worktrees = record(record(reply).result).worktrees;
  if (!Array.isArray(worktrees)) return [];
  return worktrees.flatMap((raw) => {
    const wt = record(raw);
    const id = text(wt.id);
    const repoId = text(wt.repoId);
    const path = text(wt.path);
    if (id === null || repoId === null || path === null || wt.isArchived === true) return [];
    if (wt.isBare === true) return [];
    const branch = text(wt.branch)?.replace(/^refs\/heads\//, '') ?? null;
    return [
      {
        id,
        repoId,
        path,
        branch,
        name: text(wt.displayName) ?? branch ?? path.split('/').pop() ?? path,
        main: wt.isMainWorktree === true,
      },
    ];
  });
}

function outcome(reply: unknown): LaunchResult {
  const body = record(reply);
  if (body.ok === true) return { ok: true };
  const error = record(body.error);
  const message = text(error.message) ?? text(body.error) ?? 'Orca did not start it.';
  return { ok: false, error: `Orca: ${message.replaceAll('_', ' ')}` };
}

/** Orca's CLI; `ORCA_BIN` overrides where it is. */
export function orcaLauncher(bin: string = defaultOrcaBin()): AgentLauncher {
  const launch = async (args: string[]): Promise<LaunchResult> => {
    try {
      return outcome(await runOrca(bin, args, LAUNCH_TIMEOUT_MS));
    } catch {
      return {
        ok: false,
        error: 'Orca is not reachable (is the Orca app open?).',
      };
    }
  };
  return {
    async places() {
      try {
        const [repos, worktrees] = await Promise.all([
          runOrca(bin, ['repo', 'list', '--json'], LIST_TIMEOUT_MS),
          runOrca(bin, ['worktree', 'list', '--json'], LIST_TIMEOUT_MS),
        ]);
        if (record(repos).ok !== true) return null;
        return { repos: reposFrom(repos), worktrees: worktreesFrom(worktrees) };
      } catch {
        return null;
      }
    },
    startInNewWorktree(repoId, name, prompt, provider = 'claude') {
      // `--x=value` keeps a value that starts with "--" from reading as a flag; --no-parent,
      // since the server's own folder says nothing about where this work belongs.
      return launch([
        'worktree',
        'create',
        `--repo=id:${repoId}`,
        `--name=${name}`,
        '--no-parent',
        `--agent=${provider}`,
        '--surface=terminal',
        `--prompt=${prompt}`,
        '--json',
      ]);
    },
    startInWorktree(worktreeId, prompt, provider = 'claude') {
      return launch([
        'agent',
        'launch',
        `--agent=${provider}`,
        `--worktree=id:${worktreeId}`,
        '--surface=terminal',
        `--prompt=${prompt}`,
        '--json',
      ]);
    },
  };
}
