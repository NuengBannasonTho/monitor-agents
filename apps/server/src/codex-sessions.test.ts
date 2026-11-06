import { describe, expect, it } from 'vitest';
import { codexRolloutEvent } from './codex-sessions.js';

const timestamp = '2026-11-06T12:00:00.000Z';

describe('Codex rollout normalization', () => {
  it('shows turn and tool progress without exposing prompts or output', () => {
    const meta = codexRolloutEvent(
      {
        type: 'session_meta',
        timestamp,
        payload: { id: 'thread-1', cwd: '/repo/my-project' },
      },
      null,
    );
    expect(meta.event).toMatchObject({
      sessionId: 'codex:thread-1',
      kind: 'codex',
      type: 'start',
      cwd: '/repo/my-project',
    });
    const started = codexRolloutEvent(
      {
        type: 'event_msg',
        timestamp,
        payload: { type: 'task_started', prompt: 'private prompt' },
      },
      meta.session,
    );
    expect(started.event).toMatchObject({
      type: 'prompt',
      summary: 'Codex turn started',
    });
    expect(JSON.stringify(started.event)).not.toContain('private prompt');

    const command = codexRolloutEvent(
      {
        type: 'event_msg',
        timestamp,
        payload: {
          type: 'item_completed',
          item: {
            type: 'CommandExecution',
            command: 'pnpm test',
            aggregated_output: 'secret output',
          },
        },
      },
      meta.session,
    );
    expect(command.event).toMatchObject({
      kind: 'codex',
      type: 'tool',
      toolName: 'Codex',
      summary: 'Command finished: pnpm test',
    });
    expect(JSON.stringify(command.event)).not.toContain('secret output');

    const done = codexRolloutEvent(
      {
        type: 'event_msg',
        timestamp,
        payload: {
          type: 'task_complete',
          last_agent_message: 'private answer',
        },
      },
      meta.session,
    );
    expect(done.event).toMatchObject({
      type: 'stop',
      summary: 'Codex turn finished',
    });
    expect(JSON.stringify(done.event)).not.toContain('private answer');
  });

  it('ignores unknown and malformed records', () => {
    expect(
      codexRolloutEvent(
        { type: 'session_meta', payload: { id: 'a', cwd: 'relative' } },
        null,
      ).event,
    ).toBeNull();
    expect(
      codexRolloutEvent(
        { type: 'response_item', payload: { type: 'message' } },
        null,
      ).event,
    ).toBeNull();
  });
});
