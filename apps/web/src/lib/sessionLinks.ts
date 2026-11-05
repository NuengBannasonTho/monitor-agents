import type { Agent } from '@agent-office/shared';

/** POSIX single-quote escaping, so folders with spaces or quotes paste safely. */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Opens the agent's folder in VS Code (the vscode:// handler, nothing leaves the machine). */
export function editorUrl(cwd: string): string {
  const path = cwd.startsWith('/') ? cwd : `/${cwd}`;
  return `vscode://file${encodeURI(path)}`;
}

/** A terminal command that continues this conversation, for agents that support it. */
export function resumeCommand(agent: Pick<Agent, 'kind' | 'id' | 'cwd'>): string | null {
  if (agent.kind !== 'claude-code') return null;
  return `cd ${shellQuote(agent.cwd)} && claude --resume ${agent.id}`;
}
