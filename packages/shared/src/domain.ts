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
  summary: z.string().optional(),
  at: EpochMsSchema,
});
export type AgentEvent = z.infer<typeof AgentEventSchema>;

export const ActivityEntrySchema = z.object({
  at: EpochMsSchema,
  state: AgentStateSchema,
  summary: z.string(),
});
export type ActivityEntry = z.infer<typeof ActivityEntrySchema>;

export const AgentSchema = z.object({
  id: z.string().min(1),
  kind: AgentKindSchema,
  desk: z.string(),
  cwd: z.string(),
  state: AgentStateSchema,
  activity: z.array(ActivityEntrySchema).max(MAX_ACTIVITY),
  lastSeen: EpochMsSchema,
});
export type Agent = z.infer<typeof AgentSchema>;

export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('snapshot'), agents: z.array(AgentSchema) }),
  z.object({ type: z.literal('upsert'), agent: AgentSchema }),
  z.object({ type: z.literal('remove'), id: z.string().min(1) }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
