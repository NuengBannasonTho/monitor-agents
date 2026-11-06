import { describe, expect, it } from 'vitest';
import { createClaudeCodeAdapter } from './claude-code.js';

const NOW = 1_800_000_000_000;
// Summaries alone (ACTIVITY_DETAILS=off): nothing beyond the short line is kept.
const adapter = createClaudeCodeAdapter(() => NOW, { details: false });
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

describe('claude-code adapter, details off: every hook type', () => {
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
    ).toEqual({
      ...base,
      type: 'subagent-stop',
      subagentId: 'a1',
      subagentType: 'Explore',
      summary: 'Subagent finished: Explore',
    });
  });

  it('SubagentStart -> subagent-start, and its steps carry its id', () => {
    expect(
      adapter.normalize(hook('SubagentStart', { agent_id: 'a1', agent_type: 'Explore' })),
    ).toEqual({
      ...base,
      type: 'subagent-start',
      subagentId: 'a1',
      subagentType: 'Explore',
      summary: 'Subagent started: Explore',
    });
    const step = adapter.normalize(
      hook('PreToolUse', {
        agent_id: 'a1',
        agent_type: 'Explore',
        tool_name: 'Read',
        tool_input: { file_path: `${CWD}/a.ts` },
      }),
    );
    expect(step).toMatchObject({ type: 'tool', subagentId: 'a1', subagentType: 'Explore' });
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

describe('claude-code adapter, details on', () => {
  const detailed = createClaudeCodeAdapter(() => NOW);

  it('keeps the prompt in the detail, never in the summary', () => {
    const event = detailed.normalize(hook('UserPromptSubmit', { prompt: 'Fix the login bug' }));
    expect(event?.summary).toBe('Prompt received');
    expect(event?.detail).toEqual([{ type: 'text', label: 'Prompt', text: 'Fix the login bug' }]);
  });

  it('shows the full command, redacted', () => {
    const command = 'API_KEY=sk-live-0123456789 pnpm deploy --prod && echo done';
    const event = detailed.normalize(
      hook('PreToolUse', {
        tool_name: 'Bash',
        tool_input: { command, description: 'Deploy' },
        tool_use_id: 'toolu_1',
      }),
    );
    expect(event?.detail).toEqual([
      { type: 'field', label: 'What', value: 'Deploy' },
      {
        type: 'code',
        label: 'Command',
        code: 'API_KEY=[REDACTED] pnpm deploy --prod && echo done',
        lang: 'shellscript',
      },
    ]);
  });

  it('shows an edit as a diff, keeping ordinary code that mentions keys', () => {
    const event = detailed.normalize(
      hook('PreToolUse', {
        tool_name: 'Edit',
        tool_input: {
          file_path: `${CWD}/src/List.tsx`,
          old_string: '<li>{item}</li>',
          new_string: '<li key={item.id}>{item.name}</li>',
        },
      }),
    );
    expect(event?.detail).toEqual([
      { type: 'field', label: 'File', value: 'src/List.tsx' },
      {
        type: 'code',
        label: 'Change',
        code: '- <li>{item}</li>\n+ <li key={item.id}>{item.name}</li>',
        lang: 'diff',
      },
    ]);
  });

  it('redacts everything written to a .env file', () => {
    const event = detailed.normalize(
      hook('PreToolUse', {
        tool_name: 'Write',
        tool_input: { file_path: `${CWD}/.env.local`, content: 'DB_PASSWORD=hunter2hunter2\n' },
      }),
    );
    expect(JSON.stringify(event)).not.toContain('hunter2');
  });

  it('keeps the end of a command output, with how long it took', () => {
    const stdout = `${'x'.repeat(5_000)}\nAll 12 tests passed`;
    const event = detailed.normalize(
      hook('PostToolUse', {
        tool_name: 'Bash',
        tool_use_id: 'toolu_1',
        duration_ms: 2_500,
        tool_response: { stdout, stderr: '', interrupted: false },
      }),
    );
    expect(event?.summary).toBeUndefined();
    const [took, output] = event?.detail ?? [];
    expect(took).toEqual({ type: 'field', label: 'Took', value: '3s' });
    expect(output?.type).toBe('code');
    const code = output?.type === 'code' ? output.code : '';
    expect(code.startsWith('… earlier output trimmed\n')).toBe(true);
    expect(code.endsWith('All 12 tests passed')).toBe(true);
  });

  it("keeps Claude's reply when it stops", () => {
    const event = detailed.normalize(hook('Stop', { last_assistant_message: 'Done: 3 files.' }));
    expect(event?.detail).toEqual([{ type: 'text', label: 'Reply', text: 'Done: 3 files.' }]);
  });

  it('shows the input of an unknown tool as JSON', () => {
    const event = detailed.normalize(
      hook('PreToolUse', { tool_name: 'mcp__docs__search', tool_input: { query: 'hooks' } }),
    );
    expect(event?.detail).toEqual([
      { type: 'code', label: 'Input', code: '{\n  "query": "hooks"\n}', lang: 'json' },
    ]);
  });
});
