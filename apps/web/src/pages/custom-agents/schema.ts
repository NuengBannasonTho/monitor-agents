import { CUSTOM_AGENT_NAME_PATTERN, CustomAgentInputSchema } from '@agent-office/shared';
import type { CustomAgent, CustomAgentColor, CustomAgentInput } from '@agent-office/shared';
import { CUSTOM_AGENT_COLORS } from '@agent-office/shared';

/** Claude Code's built-in tools, offered as toggles; anything else goes in "other tools". */
export const COMMON_TOOLS = [
  'Read',
  'Edit',
  'Write',
  'Glob',
  'Grep',
  'Bash',
  'WebFetch',
  'WebSearch',
  'NotebookEdit',
  'TodoWrite',
  'Task',
] as const;

/** Model choices; '' leaves the model out (the main conversation's model). */
export const MODELS: readonly { readonly value: string; readonly label: string }[] = [
  { value: '', label: 'Same as the main conversation' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'opus', label: 'Opus' },
  { value: 'haiku', label: 'Haiku' },
];

/** The form's state: like the file's fields, shaped for inputs. */
export interface Draft {
  readonly name: string;
  readonly description: string;
  /** No tools line: every tool the main conversation has. */
  readonly allTools: boolean;
  readonly tools: readonly string[];
  /** Other tools, comma-separated: MCP tools, Bash(git:*) rules. */
  readonly otherTools: string;
  readonly model: string;
  readonly color: CustomAgentColor | null;
  readonly prompt: string;
}

export type DraftField = 'name' | 'description' | 'tools' | 'model' | 'prompt';

const isCommon = (tool: string): boolean => (COMMON_TOOLS as readonly string[]).includes(tool);

const colorOf = (color: string | null): CustomAgentColor | null =>
  CUSTOM_AGENT_COLORS.find((c) => c === color) ?? null;

export function draftOf(agent: CustomAgent): Draft {
  const tools = agent.tools ?? [];
  return {
    name: agent.name,
    description: agent.description,
    allTools: agent.tools === null,
    tools: tools.filter(isCommon),
    otherTools: tools.filter((t) => !isCommon(t)).join(', '),
    model: agent.model ?? '',
    color: colorOf(agent.color),
    prompt: agent.prompt.replace(/\s+$/, ''),
  };
}

export const NEW_DRAFT: Draft = {
  name: '',
  description: '',
  allTools: true,
  tools: ['Read', 'Glob', 'Grep'],
  otherTools: '',
  model: '',
  color: null,
  prompt: '',
};

export function sameDraft(a: Draft, b: Draft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The tools to write, in the order they were (toggled-on ones at the end), then the other
 * tools; null for every tool.
 */
export function toolsOf(draft: Draft): string[] | null {
  if (draft.allTools) return null;
  const other = draft.otherTools
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  return [...new Set([...draft.tools, ...other])];
}

/** The draft as the server wants it, or what to fix, per field. */
export function inputOf(
  draft: Draft,
):
  | { readonly ok: true; readonly input: CustomAgentInput }
  | { readonly ok: false; readonly errors: Partial<Record<DraftField, string>> } {
  const errors: Partial<Record<DraftField, string>> = {};
  if (!CUSTOM_AGENT_NAME_PATTERN.test(draft.name)) {
    errors.name =
      draft.name === ''
        ? 'Give it a name'
        : 'Lowercase letters, digits and hyphens, starting with a letter or digit';
  }
  if (draft.description.trim() === '') errors.description = 'Say when Claude should use it';
  const tools = toolsOf(draft);
  if (tools !== null && tools.length === 0) errors.tools = 'Pick a tool, or allow all of them';
  const parsed = CustomAgentInputSchema.safeParse({
    name: draft.name,
    description: draft.description,
    tools,
    model: draft.model.trim() === '' ? null : draft.model.trim(),
    color: draft.color,
    prompt: draft.prompt,
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (
        (field === 'name' || field === 'description' || field === 'model' || field === 'prompt') &&
        errors[field] === undefined
      ) {
        errors[field] = issue.message;
      }
      if (field === 'tools' && errors.tools === undefined) {
        errors.tools = 'A tool name cannot hold a comma or a line break';
      }
    }
  }
  return Object.keys(errors).length > 0 || !parsed.success
    ? { ok: false, errors }
    : { ok: true, input: parsed.data };
}
