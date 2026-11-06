import { zoneOf } from '@agent-office/shared';
import type { Agent } from '@agent-office/shared';
import { formatSpan } from './duration';
import { formatRelative } from './relative-time';

/** A tool must run this long before it gets its own line. */
const TOOL_LINE_FROM_MS = 5_000;

/**
 * How long the agent has been at it, as short sentences, most important first:
 * "Waiting on you for 4 min", "Bash running for 3 min", "Finished 2m ago, took 8 min".
 */
export function timingLines(agent: Agent, now: number): string[] {
  const lines: string[] = [];
  if (agent.state === 'needs-you') {
    lines.push(`Waiting on you for ${formatSpan(now - agent.stateSince)}`);
  } else if (zoneOf(agent.state) === 'table') {
    if (agent.tool !== undefined && now - agent.tool.since >= TOOL_LINE_FROM_MS) {
      lines.push(`${agent.tool.name} running for ${formatSpan(now - agent.tool.since)}`);
    }
    if (agent.turnStartedAt !== undefined) {
      lines.push(`On your prompt for ${formatSpan(now - agent.turnStartedAt)}`);
    }
  } else {
    if (agent.state === 'stale') lines.push(`No events for ${formatSpan(now - agent.lastSeen)}`);
    if (agent.finishedAt !== undefined) {
      const took = agent.lastTurnMs === undefined ? '' : `, took ${formatSpan(agent.lastTurnMs)}`;
      lines.push(`Finished ${formatRelative(agent.finishedAt, now)}${took}`);
    } else if (agent.state === 'idle') {
      lines.push(`Idle for ${formatSpan(now - agent.stateSince)}`);
    }
  }
  return lines;
}

/** What the name tag's timer counts from, if anything is worth timing there. */
export function tagTimerStart(agent: Agent, now: number): number | null {
  if (agent.state === 'needs-you') return agent.stateSince;
  // Long tool calls only: a build or test run you might be waiting for.
  if (agent.tool !== undefined && now - agent.tool.since >= 60_000) return agent.tool.since;
  return null;
}
