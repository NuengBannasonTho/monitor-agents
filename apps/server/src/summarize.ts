import path from 'node:path';
import type { AgentState } from '@agent-office/shared';
import { redactSecrets, singleLine, truncate } from './redact.js';

export const BASH_MAX = 80;
const TARGET_MAX = 100;

const READING_TOOLS: ReadonlySet<string> = new Set(['Read', 'Grep', 'Glob']);
const FILE_TOOLS: ReadonlySet<string> = new Set(['Read', 'Edit', 'Write', 'MultiEdit']);

export function stateForTool(toolName: string): AgentState {
  if (READING_TOOLS.has(toolName)) return 'reading';
  if (toolName === 'Bash') return 'running';
  return 'working';
}

/** Path relative to cwd when it lives inside cwd; otherwise the path as given. */
export function relativeToCwd(filePath: string, cwd: string): string {
  if (cwd === '' || !path.isAbsolute(filePath)) return filePath;
  const rel = path.relative(cwd, filePath);
  return rel === '' || rel.startsWith('..') || path.isAbsolute(rel) ? filePath : rel;
}

function stringField(input: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = input[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * One short, redacted line describing a tool call. Only the target is kept
 * (file path, search pattern, command); everything else in tool_input is dropped.
 */
export function summarizeTool(
  toolName: string,
  toolInput: Readonly<Record<string, unknown>>,
  cwd: string,
): string {
  const name = truncate(singleLine(toolName), 60);
  let target: string | undefined;

  if (FILE_TOOLS.has(toolName)) {
    const file = stringField(toolInput, 'file_path');
    target = file === undefined ? undefined : relativeToCwd(file, cwd);
  } else if (toolName === 'NotebookEdit') {
    const file = stringField(toolInput, 'notebook_path');
    target = file === undefined ? undefined : relativeToCwd(file, cwd);
  } else if (toolName === 'Grep') {
    const pattern = stringField(toolInput, 'pattern');
    target = pattern === undefined ? undefined : `"${pattern}"`;
  } else if (toolName === 'Glob') {
    target = stringField(toolInput, 'pattern');
  } else if (toolName === 'Bash') {
    const command = stringField(toolInput, 'command');
    if (command !== undefined) {
      // Redact before truncating so a secret is never half-kept at the cut.
      return `${name} ${truncate(redactSecrets(singleLine(command)), BASH_MAX)}`;
    }
  }

  if (target === undefined) return name;
  return `${name} ${truncate(redactSecrets(singleLine(target)), TARGET_MAX)}`;
}

/** Generic short label: single line, redacted, truncated. */
export function safeLabel(text: string, max = 60): string {
  return truncate(redactSecrets(singleLine(text)), max);
}
