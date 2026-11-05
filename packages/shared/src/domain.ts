import { z } from 'zod';

/** Maximum activity entries kept per agent. */
export const MAX_ACTIVITY = 20;

export const AGENT_KINDS = ['claude-code', 'codex', 'other'] as const;
export const AgentKindSchema = z.enum(AGENT_KINDS);
export type AgentKind = z.infer<typeof AgentKindSchema>;

export const AGENT_STATES = [
  'idle',
  'called',
  'working',
  'reading',
  'running',
  'needs-you',
  'done',
  'stale',
] as const;
export const AgentStateSchema = z.enum(AGENT_STATES);
export type AgentState = z.infer<typeof AgentStateSchema>;

export const AGENT_EVENT_TYPES = [
  'start',
  'prompt',
  'tool',
  'tool-end',
  'notify',
  'stop',
  'subagent-stop',
  'end',
] as const;
export const AgentEventTypeSchema = z.enum(AGENT_EVENT_TYPES);
export type AgentEventType = z.infer<typeof AgentEventTypeSchema>;

/** Epoch milliseconds. */
const EpochMsSchema = z.number().int().nonnegative();

export const AgentEventSchema = z.object({
  sessionId: z.string().min(1),
  kind: AgentKindSchema,
  cwd: z.string(),
  type: AgentEventTypeSchema,
  toolName: z.string().optional(),
  /** Pairs a tool call's start with its end (Claude Code's tool_use_id). */
  toolId: z.string().optional(),
  /** Activity line; a 'tool-end' without one (a quick, successful call) adds no line. */
  summary: z.string().optional(),
  /** A tool call that failed or was interrupted. */
  failed: z.boolean().optional(),
  at: EpochMsSchema,
});
export type AgentEvent = z.infer<typeof AgentEventSchema>;

export const ActivityEntrySchema = z.object({
  at: EpochMsSchema,
  state: AgentStateSchema,
  summary: z.string(),
  failed: z.boolean().optional(),
});
export type ActivityEntry = z.infer<typeof ActivityEntrySchema>;

/** A tool call that has started and not ended yet. */
export const RunningToolSchema = z.object({
  id: z.string(),
  name: z.string(),
  since: EpochMsSchema,
});
export type RunningTool = z.infer<typeof RunningToolSchema>;

const AgentObjectSchema = z.object({
  id: z.string().min(1),
  kind: AgentKindSchema,
  desk: z.string(),
  cwd: z.string(),
  state: AgentStateSchema,
  /** When the agent entered its current state. */
  stateSince: EpochMsSchema,
  /** When you sent the prompt the agent is working on; absent between turns. */
  turnStartedAt: EpochMsSchema.optional(),
  /** The latest tool call still in progress. */
  tool: RunningToolSchema.optional(),
  /** When the agent last finished a turn. */
  finishedAt: EpochMsSchema.optional(),
  /** How long that last turn took, when its start was seen. */
  lastTurnMs: z.number().int().nonnegative().optional(),
  activity: z.array(ActivityEntrySchema).max(MAX_ACTIVITY),
  lastSeen: EpochMsSchema,
});
/**
 * An agent as sent to the browser. A server from before `stateSince` existed (still running
 * while the page is rebuilt) sends none; its last event is the best guess.
 */
export const AgentSchema = z.preprocess(
  (raw) =>
    typeof raw === 'object' && raw !== null && !('stateSince' in raw) && 'lastSeen' in raw
      ? { ...raw, stateSince: raw.lastSeen }
      : raw,
  AgentObjectSchema,
);
export type Agent = z.infer<typeof AgentSchema>;

export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('snapshot'), agents: z.array(AgentSchema) }),
  z.object({ type: z.literal('upsert'), agent: AgentSchema }),
  z.object({ type: z.literal('remove'), id: z.string().min(1) }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
