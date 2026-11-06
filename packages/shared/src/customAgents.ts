import { z } from 'zod';

/*
 * Custom agents: Claude Code subagents, one Markdown file each with YAML frontmatter
 * (name, description, tools, model, color) and the agent's system prompt as the body.
 * Yours live in ~/.claude/agents; a project's in <project>/.claude/agents.
 */

/** The colors Claude Code can show a subagent in. */
export const CUSTOM_AGENT_COLORS = [
  'red',
  'orange',
  'yellow',
  'green',
  'cyan',
  'blue',
  'purple',
  'pink',
] as const;
export const CustomAgentColorSchema = z.enum(CUSTOM_AGENT_COLORS);
export type CustomAgentColor = z.infer<typeof CustomAgentColorSchema>;

/** Lowercase letters, digits and hyphens; a new agent's file is named after it. */
export const CUSTOM_AGENT_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** One tool or permission rule: Read, Bash(git status:*), mcp__github__get_issue. */
const TOOL_PATTERN = /^[^,\r\n]{1,200}$/;
/** A model alias (sonnet, opus, haiku, inherit) or a full model id. */
const MODEL_PATTERN = /^[A-Za-z0-9._[\]-]{1,80}$/;
export const MAX_CUSTOM_AGENT_PROMPT = 100_000;

/** What you edit: the fields Claude Code reads. Anything else in the file is kept as it is. */
export const CustomAgentInputSchema = z.object({
  name: z.string().regex(CUSTOM_AGENT_NAME_PATTERN, 'Use lowercase letters, digits and hyphens'),
  description: z.string().trim().min(1, 'Say when Claude should use this agent').max(2_000),
  /** null: every tool the main conversation has. */
  tools: z.array(z.string().trim().regex(TOOL_PATTERN)).max(100).nullable(),
  /** null: the default model (Claude Code's inherit). */
  model: z.string().trim().regex(MODEL_PATTERN).nullable(),
  color: CustomAgentColorSchema.nullable(),
  prompt: z.string().max(MAX_CUSTOM_AGENT_PROMPT),
});
export type CustomAgentInput = z.infer<typeof CustomAgentInputSchema>;

/** Where agents are kept: yours, or one project's (a folder an agent is working in). */
export const CustomAgentScopeSchema = z.object({
  /** "user", or "project:" and the project folder. */
  id: z.string(),
  kind: z.enum(['user', 'project']),
  label: z.string(),
  /** The .claude/agents folder. */
  dir: z.string(),
  exists: z.boolean(),
});
export type CustomAgentScope = z.infer<typeof CustomAgentScopeSchema>;

/** An agent file as found on disk; fields can be odd, since people edit these by hand. */
export const CustomAgentSchema = z.object({
  scope: z.string(),
  /** Path inside the scope's folder, e.g. "reviewer.md" or "team/reviewer.md". */
  file: z.string(),
  path: z.string(),
  name: z.string(),
  description: z.string(),
  tools: z.array(z.string()).nullable(),
  model: z.string().nullable(),
  color: z.string().nullable(),
  prompt: z.string(),
  /** A comment at the top of the frontmatter, e.g. that another tool manages the file. */
  note: z.string().nullable(),
  /** Why the file cannot be edited here (no frontmatter, broken YAML); null when fine. */
  problem: z.string().nullable(),
  /** The file's last change, to refuse saving over an edit made elsewhere meanwhile. */
  modifiedAt: z.number(),
});
export type CustomAgent = z.infer<typeof CustomAgentSchema>;

export const CustomAgentListSchema = z.object({
  /** Saving and deleting are on (CUSTOM_AGENTS=on); otherwise the page is read-only. */
  editable: z.boolean(),
  scopes: z.array(CustomAgentScopeSchema),
  agents: z.array(CustomAgentSchema),
});
export type CustomAgentList = z.infer<typeof CustomAgentListSchema>;

/** Create (no file) or update (file, and when you loaded it) an agent. */
export const SaveCustomAgentSchema = z.object({
  scope: z.string().min(1).max(5_000),
  file: z.string().min(1).max(1_000).optional(),
  modifiedAt: z.number().optional(),
  agent: CustomAgentInputSchema,
});
export type SaveCustomAgent = z.infer<typeof SaveCustomAgentSchema>;

export const DeleteCustomAgentSchema = z.object({
  scope: z.string().min(1).max(5_000),
  file: z.string().min(1).max(1_000),
});
export type DeleteCustomAgent = z.infer<typeof DeleteCustomAgentSchema>;
