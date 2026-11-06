import type { UsageRange, UsageReport } from '@agent-office/shared';

/*
 * Made-up usage for the static preview (no server, no transcripts): the same shape as a
 * real report, the same numbers every time for a given range.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** A small repeatable sequence in 0..1. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16_807) % 2_147_483_647;
    return s / 2_147_483_647;
  };
}

const tokens = (input: number, output: number, cacheRead: number, cacheWrite: number) => ({
  input,
  output,
  cacheRead,
  cacheWrite,
});

export function sampleUsageReport(range: UsageRange, now: number): UsageReport {
  const days = range === 'today' ? 1 : range === '7d' ? 7 : 30;
  const scale = range === 'today' ? 1 : days * 0.8;
  const random = seeded(days * 97);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const since = start.getTime();

  const bucket = range === 'today' ? 'hour' : 'day';
  const count = range === 'today' ? 24 : days;
  const points = Array.from({ length: count }, (_, i) => {
    const at = since + i * (bucket === 'hour' ? HOUR : DAY);
    const working = bucket === 'day' || (i >= 9 && i <= 18 && at <= now);
    const cost = working && at <= now ? 2 + random() * (bucket === 'hour' ? 6 : 60) : 0;
    const sub = cost * random() * 0.3;
    return {
      at,
      costUsd: cost,
      subagentCostUsd: sub,
      tokens: Math.round(cost * 210_000),
      calls: Math.round(cost * 9),
    };
  });
  const cost = points.reduce((a, p) => a + p.costUsd, 0);
  const subCost = points.reduce((a, p) => a + p.subagentCostUsd, 0);
  const t = tokens(
    Math.round(cost * 400),
    Math.round(cost * 9_000),
    Math.round(cost * 190_000),
    Math.round(cost * 9_500),
  );
  const calls = points.reduce((a, p) => a + p.calls, 0);

  const session = (
    id: string,
    title: string,
    cwd: string,
    share: number,
    context: number,
    hoursAgo: number,
  ) => ({
    id,
    title,
    cwd,
    model: 'claude-opus-5-5',
    costUsd: cost * share,
    subagentCostUsd: subCost * share,
    tokens: tokens(t.input * share, t.output * share, t.cacheRead * share, t.cacheWrite * share),
    calls: Math.round(calls * share),
    contextTokens: context,
    peakContextTokens: Math.round(context * 1.3),
    contextWindow: 1_000_000,
    compactions: context > 600_000 ? 2 : 0,
    subagentRuns: Math.round(4 * share * scale),
    toolCalls: Math.round(calls * share * 1.2),
    skillCalls: Math.round(3 * share * scale),
    startedAt: now - (hoursAgo + 5) * HOUR,
    lastAt: now - hoursAgo * HOUR,
  });
  const sessions = [
    session('preview-1', 'Checkout page redesign', '/work/shop/feat-checkout', 0.42, 412_000, 0.1),
    session('preview-2', 'Fix flaky login test', '/work/shop/fix-login', 0.25, 185_000, 0.6),
    session('preview-3', 'Migrate the orders API', '/work/api/orders-v2', 0.21, 731_000, 2),
    session('preview-4', 'Write release notes', '/work/docs/main', 0.12, 64_000, 5),
  ].map((s) => ({
    ...s,
    tokens: {
      input: Math.round(s.tokens.input),
      output: Math.round(s.tokens.output),
      cacheRead: Math.round(s.tokens.cacheRead),
      cacheWrite: Math.round(s.tokens.cacheWrite),
    },
  }));

  const n = (x: number) => Math.max(1, Math.round(x * scale));
  return {
    range,
    since,
    generatedAt: now,
    available: true,
    totals: {
      costUsd: cost,
      subagentCostUsd: subCost,
      uncachedCostUsd: cost * 9.4,
      tokens: t,
      calls,
      sessions: sessions.length,
      subagentRuns: n(5),
      toolCalls: Math.round(calls * 1.2),
      skillCalls: n(4),
    },
    timeline: { bucket, points },
    models: [
      {
        model: 'claude-opus-5-5',
        costUsd: cost * 0.93,
        tokens: t,
        calls: Math.round(calls * 0.9),
        unpriced: false,
      },
      {
        model: 'claude-sonnet-5-5',
        costUsd: cost * 0.06,
        tokens: t,
        calls: Math.round(calls * 0.08),
        unpriced: false,
      },
      {
        model: 'claude-haiku-5-5',
        costUsd: cost * 0.01,
        tokens: t,
        calls: Math.round(calls * 0.02),
        unpriced: false,
      },
    ],
    sessions,
    skills: [
      {
        name: 'git-workflow',
        calls: n(3),
        byYou: 0,
        sessions: n(2),
        approxTokens: 1_100,
        lastAt: now - HOUR,
      },
      {
        name: 'frontend-design',
        calls: n(2),
        byYou: 1,
        sessions: n(1),
        approxTokens: 2_300,
        lastAt: now - 3 * HOUR,
      },
      {
        name: 'claude-api',
        calls: n(1),
        byYou: 0,
        sessions: 1,
        approxTokens: 31_000,
        lastAt: now - 5 * HOUR,
      },
    ],
    subagents: [
      {
        type: 'general-purpose',
        runs: n(2),
        costUsd: subCost * 0.6,
        tokens: tokens(0, 90_000, 4_000_000, 200_000),
        calls: n(60),
        toolCalls: n(80),
        lastAt: now - HOUR,
      },
      {
        type: 'Explore',
        runs: n(3),
        costUsd: subCost * 0.3,
        tokens: tokens(0, 40_000, 2_000_000, 90_000),
        calls: n(40),
        toolCalls: n(70),
        lastAt: now - 2 * HOUR,
      },
      {
        type: 'code-reviewer',
        runs: n(1),
        costUsd: subCost * 0.1,
        tokens: tokens(0, 10_000, 600_000, 40_000),
        calls: n(12),
        toolCalls: n(15),
        lastAt: now - 4 * HOUR,
      },
    ],
    tools: [
      {
        name: 'Bash',
        server: null,
        calls: Math.round(calls * 0.6),
        bySubagents: n(20),
      },
      {
        name: 'Edit',
        server: null,
        calls: Math.round(calls * 0.2),
        bySubagents: 0,
      },
      {
        name: 'Read',
        server: null,
        calls: Math.round(calls * 0.15),
        bySubagents: n(30),
      },
      {
        name: 'mcp__github__search_issues',
        server: 'github',
        calls: n(6),
        bySubagents: 0,
      },
    ],
    projects: [
      {
        cwd: '/work/shop/feat-checkout',
        sessions: 1,
        costUsd: cost * 0.42,
        tokens: 0,
        lastAt: now,
      },
      {
        cwd: '/work/shop/fix-login',
        sessions: 1,
        costUsd: cost * 0.25,
        tokens: 0,
        lastAt: now - HOUR,
      },
      {
        cwd: '/work/api/orders-v2',
        sessions: 1,
        costUsd: cost * 0.21,
        tokens: 0,
        lastAt: now - 2 * HOUR,
      },
      {
        cwd: '/work/docs/main',
        sessions: 1,
        costUsd: cost * 0.12,
        tokens: 0,
        lastAt: now - 5 * HOUR,
      },
    ],
  };
}
