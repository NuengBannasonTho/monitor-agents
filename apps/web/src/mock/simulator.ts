import { MAX_ACTIVITY, deskFromCwd, zoneOf } from '@agent-office/shared';
import type { ActivityEntry, Agent, AgentKind, AgentState } from '@agent-office/shared';
import { hashString, seededRandom } from '../lib/seed';

/**
 * Client-side simulator that produces Agent objects directly, so the static
 * preview works without a server. Real mock mode (`pnpm dev:mock`) instead posts
 * raw hook events to the server; see apps/server/src/mock/generator.ts.
 */

const WORKTREES = [
  '/Users/dev/orca/worktrees/feat-auth',
  '/Users/dev/orca/worktrees/fix-flaky-tests',
  '/Users/dev/orca/worktrees/refactor-api',
  '/Users/dev/orca/worktrees/docs-site',
] as const;

const KINDS: readonly AgentKind[] = ['claude-code', 'claude-code', 'codex', 'claude-code', 'other'];

const SUMMARIES: Readonly<Partial<Record<AgentState, readonly string[]>>> = {
  called: ['Prompt received'],
  reading: [
    'Read src/auth/session.ts',
    'Grep "useSession"',
    'Glob src/**/*.test.ts',
    'Read package.json',
    'Read docs/architecture.md',
  ],
  working: [
    'Edit src/auth/session.ts',
    'Write src/api/routes/users.ts',
    'Edit tests/flaky.spec.ts',
    'TodoWrite',
    'Task (subagent)',
  ],
  running: [
    'Bash pnpm test --filter api',
    'Bash git status',
    'Bash pnpm lint',
    'Bash tsc --noEmit',
  ],
  'needs-you': ['Permission needed: Bash rm -rf dist', 'Waiting for your input'],
  done: ['Stopped', 'Subagent finished'],
  idle: ['Idle'],
  stale: ['No events for 5 min'],
};

function withoutTiming(agent: Agent): Agent {
  const copy = { ...agent };
  delete copy.turnStartedAt;
  delete copy.tool;
  delete copy.finishedAt;
  delete copy.lastTurnMs;
  return copy;
}

/** Turn, tool and finish times the real server would report for this phase. */
function timing(
  prev: Agent,
  state: AgentState,
  now: number,
  inTurn: boolean,
): Pick<Agent, 'turnStartedAt' | 'tool' | 'finishedAt' | 'lastTurnMs'> {
  if (state === 'done') {
    return {
      finishedAt: now,
      ...(prev.turnStartedAt === undefined ? {} : { lastTurnMs: now - prev.turnStartedAt }),
    };
  }
  const finished = {
    ...(prev.finishedAt === undefined ? {} : { finishedAt: prev.finishedAt }),
    ...(prev.lastTurnMs === undefined ? {} : { lastTurnMs: prev.lastTurnMs }),
  };
  if (!inTurn) return finished;
  const tool =
    state === 'running' || state === 'reading' || state === 'working'
      ? { tool: { id: `t${String(now)}`, name: state === 'running' ? 'Bash' : 'Edit', since: now } }
      : {};
  return { ...finished, turnStartedAt: prev.turnStartedAt ?? now, ...tool };
}

interface Phase {
  readonly state: AgentState;
  readonly minMs: number;
  readonly maxMs: number;
}

function buildScript(rand: () => number): Phase[] {
  const phases: Phase[] = [
    { state: 'called', minMs: 900, maxMs: 1600 },
    { state: 'reading', minMs: 1800, maxMs: 4000 },
    { state: 'working', minMs: 2500, maxMs: 5000 },
    { state: 'running', minMs: 1500, maxMs: 3500 },
    { state: 'working', minMs: 1500, maxMs: 3000 },
  ];
  if (rand() < 0.35) {
    phases.push({ state: 'needs-you', minMs: 5000, maxMs: 9000 });
    phases.push({ state: 'working', minMs: 1200, maxMs: 2500 });
  }
  phases.push({ state: 'done', minMs: 3000, maxMs: 3000 });
  if (rand() < 0.12) {
    phases.push({ state: 'stale', minMs: 6000, maxMs: 9000 });
  }
  phases.push({ state: 'idle', minMs: 3000, maxMs: 9000 });
  return phases;
}

interface SimAgent {
  agent: Agent;
  script: Phase[];
  phaseIndex: number;
  nextAt: number;
}

export class MockSimulator {
  private readonly rand: () => number;
  private readonly sims: SimAgent[];

  constructor(count: number, now: number, seed = 'agent-office') {
    this.rand = seededRandom(hashString(seed));
    this.sims = Array.from({ length: count }, (_, i) => this.createSim(i, now));
  }

  agents(): Agent[] {
    return this.sims.map((s) => s.agent);
  }

  /** Advances any agent whose phase has elapsed. Returns true if anything changed. */
  tick(now: number): boolean {
    let changed = false;
    for (const sim of this.sims) {
      if (now < sim.nextAt) continue;
      this.advance(sim, now);
      changed = true;
    }
    return changed;
  }

  private createSim(index: number, now: number): SimAgent {
    const cwd = WORKTREES[index % WORKTREES.length] ?? WORKTREES[0];
    const kind = KINDS[index % KINDS.length] ?? 'other';
    const id = `mock-${index}-${Math.floor(this.rand() * 1e9).toString(36)}`;
    const agent: Agent = {
      id,
      kind,
      desk: deskFromCwd(cwd),
      cwd,
      state: 'idle',
      stateSince: now,
      activity: [],
      lastSeen: now,
    };
    // Stagger starts so the office is lively immediately but not synchronized.
    return {
      agent,
      script: buildScript(this.rand),
      phaseIndex: -1,
      nextAt: now + 300 + index * 700,
    };
  }

  private advance(sim: SimAgent, now: number): void {
    sim.phaseIndex += 1;
    if (sim.phaseIndex >= sim.script.length) {
      sim.script = buildScript(this.rand);
      sim.phaseIndex = 0;
    }
    const phase = sim.script[sim.phaseIndex];
    if (phase === undefined) return;
    const duration = phase.minMs + this.rand() * (phase.maxMs - phase.minMs);
    sim.nextAt = now + duration;

    const pool = SUMMARIES[phase.state] ?? [phase.state];
    const summary = pool[Math.floor(this.rand() * pool.length)] ?? phase.state;
    const entry: ActivityEntry = { at: now, state: phase.state, summary };
    const prev = sim.agent;
    const inTurn = zoneOf(phase.state) === 'table';
    sim.agent = {
      ...withoutTiming(prev),
      state: phase.state,
      stateSince: phase.state === prev.state ? prev.stateSince : now,
      ...timing(prev, phase.state, now, inTurn),
      lastSeen: phase.state === 'stale' ? prev.lastSeen : now,
      activity: [entry, ...sim.agent.activity].slice(0, MAX_ACTIVITY),
    };
  }
}
