import { z } from 'zod';

/*
 * Which Claude account the agents run on, and how much of its usage is left, as Orca
 * reports it (`orca account list`). Only names and numbers: never a token.
 */

/** One usage window: the 5-hour session, or the week. */
export const UsageWindowSchema = z.object({
  usedPercent: z.number(),
  windowMinutes: z.number(),
  resetsAt: z.number().nullable(),
  /** Orca's own wording, e.g. "2:20 PM" or "Fri 9:00 AM". */
  resets: z.string().nullable(),
});
export type UsageWindow = z.infer<typeof UsageWindowSchema>;

export const ClaudeAccountSchema = z.object({
  /** Orca's account id, or "system" for the default ~/.claude login. */
  id: z.string(),
  email: z.string(),
  organization: z.string().nullable(),
  /** Signed in through Orca, or the machine's own Claude Code login. */
  kind: z.enum(['orca', 'system']),
  /** The one new agents start with. */
  active: z.boolean(),
});
export type ClaudeAccount = z.infer<typeof ClaudeAccountSchema>;

export const AccountStatusSchema = z.object({
  /** Orca answered. */
  reachable: z.boolean(),
  accounts: z.array(ClaudeAccountSchema),
  usage: z.object({
    session: UsageWindowSchema.nullable(),
    weekly: UsageWindowSchema.nullable(),
    updatedAt: z.number().nullable(),
    /** Why there are no numbers, when there are none. */
    error: z.string().nullable(),
  }),
});
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

export const NO_ACCOUNT: AccountStatus = {
  reachable: false,
  accounts: [],
  usage: { session: null, weekly: null, updatedAt: null, error: null },
};
