import { randomUUID } from 'node:crypto';

/**
 * Mock mode: plays 6 fake Claude Code sessions across 4 fake worktrees and POSTs
 * raw hook payloads (same shape Claude Code sends) to /events, so the whole
 * pipeline (token check, adapter, reducer, coalescing, WebSocket) is exercised.
 */

const WORKTREE_ROOT = '/Users/dev/orca/worktrees';
const WORKTREES = ['feat-auth', 'fix-flaky-tests', 'refactor-api', 'docs-site'] as const;
const AGENT_COUNT = 6;

type Payload = Readonly<Record<string, unknown>>;

interface Session {
  readonly id: string;
  readonly cwd: string;
}

const FILES = [
  'src/auth/session.ts',
  'src/api/routes/users.ts',
  'tests/flaky.spec.ts',
  'docs/architecture.md',
  'package.json',
  'src/lib/cache.ts',
];
const BASH = [
  'pnpm test --filter api',
  'git status --short',
  'pnpm lint',
  'pnpm exec tsc --noEmit',
  // Exercises redaction: the key below must never reach the UI.
  'OPENAI_API_KEY=sk-mock-1234567890abcdef pnpm run eval',
  'curl -H "Authorization: Bearer mockmockmockmock123" http://localhost:3000/health',
];

const PROMPTS = [
  'The login form keeps the old session after sign-out. Find out why and fix it.',
  'Add a test for the users route that covers the 404 case.',
  'Tidy up cache.ts: the TTL logic is duplicated in two places.',
];
const EDITS: readonly (readonly [string, string])[] = [
  ['  return session;', '  if (session.expiresAt < Date.now()) return null;\n  return session;'],
  ['const TTL = 60_000;\nconst ttl = 60 * 1000;', 'const TTL_MS = 60_000;'],
  ["it.skip('retries once', async () => {", "it('retries once', async () => {"],
];
const OUTPUTS = [
  ' RUN  v3.2.4\n\n ✓ src/api/routes/users.test.ts (6 tests) 41ms\n ✓ src/auth/session.test.ts (9 tests) 18ms\n\n Test Files  2 passed (2)\n      Tests  15 passed (15)',
  ' M src/auth/session.ts\n M src/lib/cache.ts\n?? tests/session.spec.ts',
  'Checked 48 files in 312ms. No fixes applied.',
];
const REPLIES = [
  'Fixed it. Sign-out now clears the cached session:\n\n```ts\nexport function signOut() {\n  cache.delete(SESSION_KEY);\n  session = null;\n}\n```\n\nAll 15 tests pass.',
  'Added the 404 test for `GET /users/:id` and it passes. No other changes.',
];

function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) throw new Error('pick() on empty list');
  return item;
}

/** Not inlined: TS narrows `signal.aborted` to false after the first check in a loop. */
function aborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

function between(minMs: number, maxMs: number): number {
  return minMs + Math.random() * (maxMs - minMs);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function base(session: Session, event: string, extra: Payload = {}): Payload {
  return {
    session_id: session.id,
    transcript_path: `/Users/dev/.claude/projects/mock/${session.id}.jsonl`,
    cwd: session.cwd,
    permission_mode: 'default',
    hook_event_name: event,
    ...extra,
  };
}

function toolCall(session: Session, subagent?: { id: string; type: string }): Payload {
  const abs = (rel: string): string => `${session.cwd}/${rel}`;
  const sub = subagent === undefined ? {} : { agent_id: subagent.id, agent_type: subagent.type };
  const roll = Math.random();
  const [toolName, toolInput]: [string, Payload] =
    roll < 0.25
      ? ['Read', { file_path: abs(pick(FILES)) }]
      : roll < 0.35
        ? ['Grep', { pattern: pick(['useSession', 'TODO', 'export function']), path: session.cwd }]
        : roll < 0.42
          ? ['Glob', { pattern: pick(['src/**/*.ts', '**/*.test.ts']) }]
          : roll < 0.62
            ? (() => {
                const [oldText, newText] = pick(EDITS);
                return [
                  'Edit',
                  { file_path: abs(pick(FILES)), old_string: oldText, new_string: newText },
                ] as [string, Payload];
              })()
            : roll < 0.68
              ? [
                  'Write',
                  {
                    file_path: abs('tests/session.spec.ts'),
                    content:
                      "import { signOut } from '../src/auth/session';\n\nit('clears the session', () => {\n  signOut();\n  expect(current()).toBeNull();\n});\n",
                  },
                ]
              : roll < 0.74
                ? [
                    'TodoWrite',
                    {
                      todos: [
                        { content: 'Reproduce the stale session', status: 'completed' },
                        { content: 'Clear the cache on sign-out', status: 'in_progress' },
                        { content: 'Add a regression test', status: 'pending' },
                      ],
                    },
                  ]
                : ['Bash', { command: pick(BASH), description: 'Check the project' }];
  return base(session, 'PreToolUse', {
    ...sub,
    tool_name: toolName,
    tool_input: toolInput,
    tool_use_id: `toolu_${randomUUID()}`,
  });
}

/** The PostToolUse (or, now and then for Bash, PostToolUseFailure) that ends `call`. */
function toolEnd(session: Session, call: Payload, durationMs: number): Payload {
  const failed = call.tool_name === 'Bash' && Math.random() < 0.15;
  return base(session, failed ? 'PostToolUseFailure' : 'PostToolUse', {
    // A subagent's call ends inside the same subagent.
    ...(call.agent_id === undefined
      ? {}
      : { agent_id: call.agent_id, agent_type: call.agent_type }),
    tool_name: call.tool_name,
    tool_input: call.tool_input,
    tool_use_id: call.tool_use_id,
    duration_ms: durationMs,
    ...(failed
      ? {
          error:
            'Exit code 1\nFAIL src/auth/session.test.ts > signs out\nExpected null, got {"id":"u1"}',
          is_interrupt: false,
        }
      : {
          tool_response:
            call.tool_name === 'Bash'
              ? { stdout: pick(OUTPUTS), stderr: '', interrupted: false }
              : { filenames: [`${session.cwd}/src/auth/session.ts`] },
        }),
  });
}

/** How often a step launches subagents instead of calling a tool itself. */
const SUBAGENT_CHANCE = 0.25;
const SUBAGENT_TYPES = ['Explore', 'Plan', 'general-purpose', 'code-reviewer'] as const;

/**
 * The main agent calls the Agent tool once per subagent; each subagent starts
 * (SubagentStart), works in parallel with the others (its tool calls share the
 * session_id but carry its agent_id), and stops; then the Agent calls return.
 */
async function runSubagents(
  session: Session,
  post: (payload: Payload) => Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  const count = 1 + Math.floor(Math.random() * 3);
  const team = Array.from({ length: count }, () => ({
    id: `agent_${randomUUID().slice(0, 8)}`,
    type: pick(SUBAGENT_TYPES),
    call: `toolu_${randomUUID()}`,
    steps: 3 + Math.floor(Math.random() * 5),
  }));
  for (const sub of team) {
    await post(
      base(session, 'PreToolUse', {
        tool_name: 'Agent',
        tool_input: {
          subagent_type: sub.type,
          description: pick([
            'Explore the auth module',
            'Plan the cache refactor',
            'Review the diff',
          ]),
          prompt: 'Find where sessions are created and how they expire. Report file paths.',
        },
        tool_use_id: sub.call,
      }),
    );
    await post(base(session, 'SubagentStart', { agent_id: sub.id, agent_type: sub.type }));
    await sleep(between(200, 500), signal);
  }
  // Round-robin: each subagent takes a step in turn until all are done.
  let active = [...team];
  while (active.length > 0 && !aborted(signal)) {
    for (const sub of active) {
      const call = toolCall(session, sub);
      await post(call);
      const ms = between(900, 2_400);
      await sleep(ms, signal);
      await post(toolEnd(session, call, ms));
      sub.steps -= 1;
    }
    for (const sub of active.filter((s) => s.steps <= 0)) {
      await post(
        base(session, 'SubagentStop', {
          stop_hook_active: false,
          agent_id: sub.id,
          agent_type: sub.type,
          agent_transcript_path: `/tmp/${sub.id}.jsonl`,
          last_assistant_message:
            'Session handling lives in src/auth/session.ts; the cache is in src/lib/cache.ts.',
        }),
      );
      await post(
        base(session, 'PostToolUse', {
          tool_name: 'Agent',
          tool_use_id: sub.call,
          duration_ms: 8_000,
          tool_response: {
            content: [{ type: 'text', text: 'Found 3 places that create sessions.' }],
          },
        }),
      );
    }
    active = active.filter((s) => s.steps > 0);
  }
}

async function runAgent(
  index: number,
  post: (payload: Payload) => Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  const worktree = WORKTREES[index % WORKTREES.length] ?? WORKTREES[0];
  await sleep(index * 900, signal);

  while (!aborted(signal)) {
    const session: Session = { id: randomUUID(), cwd: `${WORKTREE_ROOT}/${worktree}` };
    await post(base(session, 'SessionStart', { source: 'startup', model: 'mock' }));
    const turns = 2 + Math.floor(Math.random() * 4);

    for (let turn = 0; turn < turns && !aborted(signal); turn++) {
      await sleep(between(2_000, 7_000), signal);
      await post(base(session, 'UserPromptSubmit', { prompt: pick(PROMPTS) }));
      await sleep(between(600, 1_400), signal);

      const steps = 4 + Math.floor(Math.random() * 6);
      for (let step = 0; step < steps && !aborted(signal); step++) {
        if (Math.random() < SUBAGENT_CHANCE) {
          await runSubagents(session, post, signal);
        } else {
          const call = toolCall(session);
          await post(call);
          if (Math.random() < 0.08) {
            await post(
              base(session, 'Notification', {
                message: 'Claude needs your permission to use Bash',
                notification_type: 'permission_prompt',
              }),
            );
            await sleep(between(5_000, 10_000), signal);
          }
          const ms = between(700, 2_600);
          await sleep(ms, signal);
          await post(toolEnd(session, call, ms));
          continue;
        }
        await sleep(between(700, 2_600), signal);
      }

      await post(
        base(session, 'Stop', {
          stop_hook_active: false,
          last_assistant_message: pick(REPLIES),
        }),
      );
      if (Math.random() < 0.3) {
        await sleep(4_000, signal);
        // Informational: must not pull the agent back to the table.
        await post(
          base(session, 'Notification', { message: 'Waiting', notification_type: 'idle_prompt' }),
        );
      }
    }

    await sleep(between(3_000, 8_000), signal);
    await post(base(session, 'SessionEnd', { reason: 'prompt_input_exit' }));
    await sleep(between(1_500, 4_000), signal);
  }
}

export interface MockOptions {
  readonly url: string;
  readonly token: string;
  readonly signal: AbortSignal;
  readonly onError?: (error: unknown) => void;
}

export function startMockGenerator({ url, token, signal, onError }: MockOptions): Promise<void> {
  const post = async (payload: Payload): Promise<void> => {
    if (aborted(signal)) return;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-token': token },
        body: JSON.stringify(payload),
        signal,
      });
    } catch (error) {
      if (!aborted(signal)) onError?.(error);
    }
  };
  return Promise.all(Array.from({ length: AGENT_COUNT }, (_, i) => runAgent(i, post, signal))).then(
    () => undefined,
  );
}
