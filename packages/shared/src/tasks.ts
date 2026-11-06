import { z } from 'zod';

/*
 * Starting work from the dashboard: you write a task, pick where it runs (a new worktree or
 * one Orca already has) and, if you like, a team of custom agents; Orca starts Claude Code
 * there with the task as its first prompt, and the agent shows up in the office.
 */

/** A repo Orca knows. */
export const OrcaRepoSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
});
export type OrcaRepo = z.infer<typeof OrcaRepoSchema>;

/** A worktree (or the main checkout) of one of those repos. */
export const OrcaWorktreeSchema = z.object({
  id: z.string(),
  repoId: z.string(),
  name: z.string(),
  path: z.string(),
  branch: z.string().nullable(),
  main: z.boolean(),
});
export type OrcaWorktree = z.infer<typeof OrcaWorktreeSchema>;

export const TaskPlacesSchema = z.object({
  /** Starting agents is on (START_AGENTS=on). */
  enabled: z.boolean(),
  /** Orca answered; when not, the lists are empty. */
  reachable: z.boolean(),
  repos: z.array(OrcaRepoSchema),
  worktrees: z.array(OrcaWorktreeSchema),
});
export type TaskPlaces = z.infer<typeof TaskPlacesSchema>;

export const MAX_TASK_CHARS = 20_000;
/** A new worktree's name, also its folder: letters, digits, dot, dash, underscore. */
export const WORKTREE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,59}$/;
/** Most helpers on one task. */
export const MAX_TEAM = 12;

export const StartTaskSchema = z.object({
  /** Which Orca agent starts as the lead. */
  provider: z.enum(['claude', 'codex']).default('claude'),
  task: z.string().trim().min(1, 'Write what should get done').max(MAX_TASK_CHARS),
  where: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('new'),
      repoId: z.string().min(1).max(200),
      name: z.string().regex(WORKTREE_NAME_PATTERN, 'Letters, digits, dots, dashes, underscores'),
    }),
    z.object({
      kind: z.literal('existing'),
      worktreeId: z.string().min(1).max(5_000),
    }),
  ]),
  /** Custom agents, by name, the lead hands parts of the work to; empty: it picks itself. */
  team: z
    .array(
      z
        .string()
        .min(1)
        .max(64)
        .regex(/^[^,\r\n]+$/),
    )
    .max(MAX_TEAM)
    .default([]),
});
export type StartTask = z.infer<typeof StartTaskSchema>;

/** A helper as the lead agent is told about it. */
export interface TeamMember {
  readonly name: string;
  readonly description: string;
}

/**
 * The first prompt the lead agent gets: your task, then (with a team) how to work with it.
 * The same text is previewed in the dashboard and sent by the server.
 */
export function leadPrompt(task: string, team: readonly TeamMember[]): string {
  const body = task.trim();
  if (team.length === 0) return body;
  const members = team
    .map((m) => {
      const about = m.description.replace(/\s+/g, ' ').trim();
      return `- ${m.name}${about === '' ? '' : `: ${about}`}`;
    })
    .join('\n');
  return `${body}

You lead this task with a team of subagents. Split the work into parts and hand each part to the subagent that fits it (the Agent tool, with its name as the subagent type); run parts that do not depend on each other in parallel. Check what each one returns, fix or redo what falls short, and finish with a short summary of what changed.

Your team:
${members}`;
}

/**
 * A worktree name from the task's first phrase: "Fix the login bug on Safari, then add
 * tests" → "fix-the-login-bug-on-safari". Letters other than a–z are dropped.
 */
export function worktreeNameFor(task: string): string {
  const firstPhrase = task.split(/[:.,;!?\n]/).find((part) => /[a-z0-9]/i.test(part)) ?? '';
  const slug = firstPhrase
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .slice(0, 6)
    .join('-')
    .slice(0, 40)
    .replace(/-+$/, '');
  return slug === '' ? 'task' : slug;
}
