import { describe, expect, it } from 'vitest';
import { createClaudeCodeAdapter } from './claude-code.js';

const NOW = 1_800_000_000_000;
const adapter = createClaudeCodeAdapter(() => NOW);
const CWD = '/Users/dev/orca/worktrees/feat-auth';

/** Shape of a real Claude Code hook payload (common fields). */
function hook(event: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    session_id: 'sess-1',
    transcript_path: '/Users/dev/.claude/projects/x/sess-1.jsonl',
    cwd: CWD,
    permission_mode: 'default',
    hook_event_name: event,
    ...extra,
  };
}

const base = { sessionId: 'sess-1', kind: 'claude-code', cwd: CWD, at: NOW };

describe('claude-code adapter: every hook type', () => {
  it('SessionStart -> start', () => {
    expect(adapter.normalize(hook('SessionStart', { source: 'startup', model: 'x' }))).toEqual({
      ...base,
      type: 'start',
      summary: 'Session started',
    });
    expect(adapter.normalize(hook('SessionStart', { source: 'resume' }))?.summary).toBe(
      'Session resumed',
    );
  });

  it('UserPromptSubmit -> prompt, and never keeps the prompt text', () => {
    const event = adapter.normalize(hook('UserPromptSubmit', { prompt: 'my secret plan' }));
    expect(event).toEqual({ ...base, type: 'prompt', summary: 'Prompt received' });
    expect(JSON.stringify(event)).not.toContain('secret plan');
  });

  it('PreToolUse -> tool with a short target only', () => {
    const event = adapter.normalize(
      hook('PreToolUse', {
        tool_name: 'Edit',
        tool_input: { file_path: `${CWD}/src/a.ts`, old_string: 'PRIVATE', new_string: 'x' },
        tool_use_id: 'toolu_1',
      }),
    );
    expect(event).toEqual({
      ...base,
      type: 'tool',
      toolName: 'Edit',
      toolId: 'toolu_1',
      summary: 'Edit src/a.ts',
    });
    expect(JSON.stringify(event)).not.toContain('PRIVATE');
  });

  it('PostToolUse -> tool-end; only long calls get an activity line', () => {
    const quick = adapter.normalize(
      hook('PostToolUse', {
        tool_name: 'Bash',
        tool_use_id: 'toolu_1',
        tool_input: { command: 'ls' },
        tool_response: { stdout: 'SECRET OUTPUT' },
        duration_ms: 120,
      }),
    );
    expect(quick).toEqual({ ...base, type: 'tool-end', toolName: 'Bash', toolId: 'toolu_1' });
    expect(JSON.stringify(quick)).not.toContain('SECRET');
    const long = adapter.normalize(
      hook('PostToolUse', { tool_name: 'Bash', tool_use_id: 'toolu_2', duration_ms: 125_000 }),
    );
    expect(long?.summary).toBe('Bash finished after 2m 5s');
  });

  it.each([
    [{ error: 'Exit code 1\nnpm ERR! token=abc' }, 'Bash failed (exit 1)'],
    [{ error: 'Something broke' }, 'Bash failed'],
    [{ is_interrupt: true }, 'Bash interrupted'],
  ])('PostToolUseFailure %j -> failed tool-end', (extra, summary) => {
    const event = adapter.normalize(
      hook('PostToolUseFailure', { tool_name: 'Bash', tool_use_id: 'toolu_3', ...extra }),
    );
    expect(event).toEqual({
      ...base,
      type: 'tool-end',
      toolName: 'Bash',
      toolId: 'toolu_3',
      failed: true,
      summary,
    });
    expect(JSON.stringify(event)).not.toContain('token');
  });

  it('PreToolUse inside a subagent is labelled', () => {
    const event = adapter.normalize(
      hook('PreToolUse', {
        tool_name: 'Read',
        tool_input: { file_path: `${CWD}/b.ts` },
        agent_id: 'agent_1',
        agent_type: 'Explore',
      }),
    );
    expect(event?.summary).toBe('Read b.ts (subagent Explore)');
  });

  it('PreToolUse tolerates a missing or non-object tool_input', () => {
    expect(adapter.normalize(hook('PreToolUse', { tool_name: 'Bash' }))?.summary).toBe('Bash');
    expect(
      adapter.normalize(hook('PreToolUse', { tool_name: 'Bash', tool_input: 'nope' }))?.summary,
    ).toBe('Bash');
  });

  it.each([
    ['permission_prompt', 'Needs permission'],
    ['elicitation_dialog', 'Waiting for your input'],
    ['agent_needs_input', 'Needs your input'],
  ])('Notification %s -> notify', (type, summary) => {
    expect(
      adapter.normalize(hook('Notification', { message: 'm', notification_type: type })),
    ).toEqual({ ...base, type: 'notify', summary });
  });

  it.each(['idle_prompt', 'auth_success', 'something_new'])(
    'informational Notification %s is dropped',
    (type) => {
      expect(
        adapter.normalize(hook('Notification', { message: 'm', notification_type: type })),
      ).toBeNull();
    },
  );

  it('Stop -> stop, without the assistant message', () => {
    const event = adapter.normalize(
      hook('Stop', { stop_hook_active: false, last_assistant_message: 'TOP SECRET' }),
    );
    expect(event).toEqual({ ...base, type: 'stop', summary: 'Finished' });
    expect(JSON.stringify(event)).not.toContain('TOP SECRET');
  });

  it('SubagentStop -> subagent-stop', () => {
    expect(
      adapter.normalize(
        hook('SubagentStop', {
          stop_hook_active: false,
          agent_id: 'a1',
          agent_type: 'Explore',
          agent_transcript_path: '/tmp/a1.jsonl',
        }),
      ),
    ).toEqual({ ...base, type: 'subagent-stop', summary: 'Subagent finished: Explore' });
  });

  it('SessionEnd -> end', () => {
    expect(adapter.normalize(hook('SessionEnd', { reason: 'logout' }))).toEqual({
      ...base,
      type: 'end',
      summary: 'Session ended (logout)',
    });
  });
});

describe('claude-code adapter: malformed input', () => {
  it.each([
    ['null', null],
    ['string', 'hello'],
    ['array', [1, 2]],
    ['empty object', {}],
    ['unknown event', hook('PreCompact', { trigger: 'auto' })],
    ['PostToolUse without tool_name', hook('PostToolUse')],
    ['missing session_id', { cwd: CWD, hook_event_name: 'Stop' }],
    ['empty session_id', hook('Stop', { session_id: '' })],
    ['numeric session_id', hook('Stop', { session_id: 42 })],
    ['missing cwd', { session_id: 's', hook_event_name: 'Stop' }],
    ['PreToolUse without tool_name', hook('PreToolUse')],
  ])('%s -> null', (_label, raw) => {
    expect(adapter.normalize(raw)).toBeNull();
  });
});
