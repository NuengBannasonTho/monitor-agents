import { z } from 'zod';

/*
 * How much your Claude Code agents used, read from their own transcripts on this machine
 * (~/.claude/projects): tokens, an estimated cost at API list prices, how full each
 * session's context is, and which skills, subagents and tools did the work. Numbers only:
 * no prompt, reply or file content leaves the server.
 */

export const USAGE_RANGES = ['today', '7d', '30d'] as const;
export const UsageRangeSchema = z.enum(USAGE_RANGES);
export type UsageRange = z.infer<typeof UsageRangeSchema>;

const Count = z.number().int().nonnegative();
const Usd = z.number().nonnegative();

/** Tokens by kind, as the API bills them. */
export const TokenCountsSchema = z.object({
  input: Count,
  output: Count,
  cacheRead: Count,
  cacheWrite: Count,
});
export type TokenCounts = z.infer<typeof TokenCountsSchema>;

/** One hour (today) or one day (7 and 30 days) of the timeline. */
export const UsageBucketSchema = z.object({
  /** Its local start. */
  at: z.number(),
  costUsd: Usd,
  /** Of which subagents. */
  subagentCostUsd: Usd,
  tokens: Count,
  calls: Count,
});
export type UsageBucket = z.infer<typeof UsageBucketSchema>;

export const UsageModelSchema = z.object({
  model: z.string(),
  costUsd: Usd,
  tokens: TokenCountsSchema,
  calls: Count,
  /** No list price known: its cost is left out of the totals. */
  unpriced: z.boolean(),
});
export type UsageModel = z.infer<typeof UsageModelSchema>;

/** One Claude Code session: a main agent and the subagents it started. */
export const UsageSessionSchema = z.object({
  id: z.string(),
  /** Claude Code's own title for the conversation, when it made one. */
  title: z.string().nullable(),
  cwd: z.string(),
  model: z.string().nullable(),
  costUsd: Usd,
  subagentCostUsd: Usd,
  tokens: TokenCountsSchema,
  calls: Count,
  /** How many tokens the latest request sent: what is in its context now. */
  contextTokens: Count,
  /** The most it held in this range. */
  peakContextTokens: Count,
  /** The model's context window. */
  contextWindow: Count,
  /** Times the conversation was compacted. */
  compactions: Count,
  subagentRuns: Count,
  toolCalls: Count,
  skillCalls: Count,
  startedAt: z.number(),
  lastAt: z.number(),
});
export type UsageSession = z.infer<typeof UsageSessionSchema>;

export const UsageSkillSchema = z.object({
  name: z.string(),
  calls: Count,
  /** Of which you typed (/skill), the rest Claude chose. */
  byYou: Count,
  sessions: Count,
  /** Roughly how many tokens its instructions add to the context each time it loads. */
  approxTokens: Count,
  lastAt: z.number(),
});
export type UsageSkill = z.infer<typeof UsageSkillSchema>;

/** Subagents of one kind (Explore, Plan, your custom agents…). */
export const UsageSubagentSchema = z.object({
  type: z.string(),
  runs: Count,
  costUsd: Usd,
  tokens: TokenCountsSchema,
  calls: Count,
  toolCalls: Count,
  lastAt: z.number(),
});
export type UsageSubagent = z.infer<typeof UsageSubagentSchema>;

export const UsageToolSchema = z.object({
  name: z.string(),
  /** The MCP server, for an MCP tool (mcp__server__tool). */
  server: z.string().nullable(),
  calls: Count,
  /** Of which inside subagents. */
  bySubagents: Count,
});
export type UsageTool = z.infer<typeof UsageToolSchema>;

export const UsageProjectSchema = z.object({
  cwd: z.string(),
  sessions: Count,
  costUsd: Usd,
  tokens: Count,
  lastAt: z.number(),
});
export type UsageProject = z.infer<typeof UsageProjectSchema>;

export const UsageReportSchema = z.object({
  range: UsageRangeSchema,
  since: z.number(),
  generatedAt: z.number(),
  /** A transcripts folder was found. */
  available: z.boolean(),
  totals: z.object({
    costUsd: Usd,
    subagentCostUsd: Usd,
    /** What the same requests would have cost without prompt caching. */
    uncachedCostUsd: Usd,
    tokens: TokenCountsSchema,
    calls: Count,
    sessions: Count,
    subagentRuns: Count,
    toolCalls: Count,
    skillCalls: Count,
  }),
  timeline: z.object({
    bucket: z.enum(['hour', 'day']),
    points: z.array(UsageBucketSchema),
  }),
  models: z.array(UsageModelSchema),
  sessions: z.array(UsageSessionSchema),
  skills: z.array(UsageSkillSchema),
  subagents: z.array(UsageSubagentSchema),
  tools: z.array(UsageToolSchema),
  projects: z.array(UsageProjectSchema),
});
export type UsageReport = z.infer<typeof UsageReportSchema>;

export const tokenTotal = (t: TokenCounts): number =>
  t.input + t.output + t.cacheRead + t.cacheWrite;
