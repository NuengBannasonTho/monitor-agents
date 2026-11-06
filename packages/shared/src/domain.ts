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
  'subagent-start',
  'subagent-stop',
  /** Stopped from the dashboard (Esc in its terminal); Claude Code sends no hook for it. */
  'interrupt',
  'end',
] as const;
export const AgentEventTypeSchema = z.enum(AGENT_EVENT_TYPES);
export type AgentEventType = z.infer<typeof AgentEventTypeSchema>;

/** Epoch milliseconds. */
const EpochMsSchema = z.number().int().nonnegative();

/**
 * One labelled piece of what happened in an activity line, shown when the line is opened:
 * a short `field` (file, pattern, duration), prose `text` (a prompt, Claude's reply) or a
 * `code` block (a command, a diff, file content, output) with its highlighting language.
 */
export const DetailPartSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('field'), label: z.string(), value: z.string() }),
  z.object({ type: z.literal('text'), label: z.string(), text: z.string() }),
  z.object({ type: z.literal('code'), label: z.string(), code: z.string(), lang: z.string() }),
]);
export type DetailPart = z.infer<typeof DetailPartSchema>;

/** At most this many parts per activity line. */
export const MAX_DETAIL_PARTS = 12;
export const ActivityDetailSchema = z.array(DetailPartSchema).max(MAX_DETAIL_PARTS);

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
  /** Set when the event comes from inside a subagent (Claude Code's agent_id). */
  subagentId: z.string().optional(),
  /** The subagent's kind, e.g. "Explore". */
  subagentType: z.string().optional(),
  /** The Orca terminal the agent runs in (set by the server from the hook's header). */
  terminal: z.string().optional(),
  /**
   * What happened, in full (redacted and size-capped). On a 'tool-end' it is added to the
   * line of the call it ends, e.g. a command's output under the command.
   */
  detail: ActivityDetailSchema.optional(),
  at: EpochMsSchema,
});
export type AgentEvent = z.infer<typeof AgentEventSchema>;

export const ActivityEntrySchema = z.object({
  at: EpochMsSchema,
  state: AgentStateSchema,
  summary: z.string(),
  failed: z.boolean().optional(),
  /** The tool call this line started, so its end can add the result. */
  toolId: z.string().optional(),
  detail: ActivityDetailSchema.optional(),
});
export type ActivityEntry = z.infer<typeof ActivityEntrySchema>;

/** A tool call that has started and not ended yet. */
export const RunningToolSchema = z.object({
  id: z.string(),
  name: z.string(),
  since: EpochMsSchema,
});
export type RunningTool = z.infer<typeof RunningToolSchema>;

/** Most subagents shown per agent; more than this at once are rare. */
export const MAX_SUBAGENTS = 8;

/** A subagent the agent started (Task/Agent tool), working at its own small desk. */
export const SubagentSchema = z.object({
  /** Claude Code's agent_id. */
  id: z.string().min(1),
  /** What kind of subagent, e.g. "Explore" or "general-purpose". */
  type: z.string(),
  /** called (just started), then reading / running / working per tool. */
  state: AgentStateSchema,
  since: EpochMsSchema,
  lastSeen: EpochMsSchema,
  /** Its latest step, e.g. "Read src/app.ts". */
  summary: z.string().optional(),
});
export type Subagent = z.infer<typeof SubagentSchema>;

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
  /** Subagents at work right now, oldest first. */
  subagents: z.array(SubagentSchema).max(MAX_SUBAGENTS).optional(),
  /** The Orca terminal it runs in: the dashboard can type to it there. */
  terminal: z.string().optional(),
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

/** What you chose for the desktop app (apps/desktop), kept by the server. */
/** Most hidden agents remembered; the oldest are forgotten past this. */
export const MAX_HIDDEN_WALKERS = 500;

export const DesktopPrefsSchema = z.object({
  /** Show the bananas walking on the desktop. */
  walkers: z.boolean(),
  /** Agents (by id) whose banana is kept off the desktop, oldest first. */
  hidden: z.array(z.string().min(1).max(200)).max(MAX_HIDDEN_WALKERS).default([]),
});
export type DesktopPrefs = z.infer<typeof DesktopPrefsSchema>;

/** A change to the desktop setting: all bananas on or off, and/or one agent hidden or shown. */
export const DesktopPatchSchema = z
  .object({
    walkers: z.boolean().optional(),
    agent: z.object({ id: z.string().min(1).max(200), hidden: z.boolean() }).optional(),
  })
  .refine((p) => p.walkers !== undefined || p.agent !== undefined, 'nothing to change');
export type DesktopPatch = z.infer<typeof DesktopPatchSchema>;

export const DesktopStatusSchema = DesktopPrefsSchema.extend({
  /** The desktop app is running and connected. */
  connected: z.boolean(),
});
export type DesktopStatus = z.infer<typeof DesktopStatusSchema>;

export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('snapshot'), agents: z.array(AgentSchema) }),
  z.object({ type: z.literal('upsert'), agent: AgentSchema }),
  z.object({ type: z.literal('remove'), id: z.string().min(1) }),
  /** Sent on connect and whenever the desktop setting or app changes. */
  z.object({ type: z.literal('desktop'), desktop: DesktopStatusSchema }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

/** Most text sent to an agent at once. */
export const MAX_SEND_CHARS = 8_000;
/** What you type to an agent from its drawer. */
/** Most files sent with one message, and their size (decoded). */
export const MAX_SEND_FILES = 10;
export const MAX_SEND_FILE_BYTES = 10 * 1024 * 1024;

/** A file you attach (or paste) in the drawer, base64-encoded for the trip to the server. */
export const SendFileSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().max(100).default(''),
  /** Base64, without the data: prefix. */
  data: z
    .string()
    .min(1)
    .max(Math.ceil((MAX_SEND_FILE_BYTES * 4) / 3) + 4),
});
export type SendFile = z.infer<typeof SendFileSchema>;

/** What you send to an agent: some text, files, or both. */
export const SendToAgentSchema = z
  .object({
    text: z.string().trim().max(MAX_SEND_CHARS).default(''),
    files: z.array(SendFileSchema).max(MAX_SEND_FILES).default([]),
  })
  .refine((m) => m.text !== '' || m.files.length > 0, 'nothing to send');
/** Orca terminal handles, as Orca issues them. */
export const TERMINAL_HANDLE_PATTERN = /^term_[A-Za-z0-9_-]{1,80}$/;
