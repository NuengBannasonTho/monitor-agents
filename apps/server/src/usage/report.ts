import type {
  TokenCounts,
  UsageBucket,
  UsageModel,
  UsageProject,
  UsageRange,
  UsageReport,
  UsageSession,
  UsageSkill,
  UsageSubagent,
  UsageTool,
} from '@agent-office/shared';
import { tokenTotal } from '@agent-office/shared';
import { baseModel, contextWindowFor } from './pricing.js';
import type { MessageRecord, TranscriptFile } from './transcripts.js';

const DAY_MS = 86_400_000;
const RANGE_DAYS: Readonly<Record<UsageRange, number>> = {
  today: 1,
  '7d': 7,
  '30d': 30,
};
/** Most sessions listed; the page shows the latest first. */
const MAX_SESSIONS = 300;
/** Roughly how many characters a token of skill instructions (mostly English) holds. */
const CHARS_PER_TOKEN = 4;

/** Local midnight `days - 1` days before `now`: "today" is since this midnight. */
export function rangeStart(range: UsageRange, now: number): number {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  midnight.setDate(midnight.getDate() - (RANGE_DAYS[range] - 1));
  return midnight.getTime();
}

type Bucket = UsageReport['timeline']['bucket'];

/** The local start of the hour or day `at` falls in. */
export function bucketStart(at: number, bucket: Bucket): number {
  const d = new Date(at);
  if (bucket === 'hour') d.setMinutes(0, 0, 0);
  else d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Every bucket from `since` up to now: today's 24 hours, or each day. */
function emptyTimeline(since: number, now: number, bucket: Bucket): Map<number, UsageBucket> {
  const points = new Map<number, UsageBucket>();
  const cursor = new Date(since);
  const end = bucket === 'hour' ? since + DAY_MS : now;
  while (cursor.getTime() <= end) {
    const at = cursor.getTime();
    if (bucket === 'hour' && at >= since + DAY_MS) break;
    points.set(at, { at, costUsd: 0, subagentCostUsd: 0, tokens: 0, calls: 0 });
    if (bucket === 'hour') cursor.setHours(cursor.getHours() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}

const zeroTokens = (): TokenCounts => ({
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
});

function addTokens(into: TokenCounts, m: MessageRecord): void {
  into.input += m.tokens.input;
  into.output += m.tokens.output;
  into.cacheRead += m.tokens.cacheRead;
  into.cacheWrite += m.tokens.cacheWrite5m + m.tokens.cacheWrite1h;
}

const requestTokens = (m: MessageRecord): number =>
  m.tokens.input +
  m.tokens.output +
  m.tokens.cacheRead +
  m.tokens.cacheWrite5m +
  m.tokens.cacheWrite1h;

function bump<K, V>(map: Map<K, V>, key: K, make: () => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = make();
    map.set(key, value);
  }
  return value;
}

/** mcp__github__create_issue → github. */
function mcpServer(tool: string): string | null {
  const match = /^mcp__(.+?)__/.exec(tool);
  return match?.[1] ?? null;
}

interface SessionAcc {
  session: UsageSession;
  lastContextAt: number;
}

/** Everything the transcripts say happened since the start of `range`, added up. */
export function buildReport(
  files: Iterable<TranscriptFile>,
  range: UsageRange,
  now: number,
  available: boolean,
): UsageReport {
  const since = rangeStart(range, now);
  const inRange = (at: number) => at >= since && at <= now + DAY_MS;

  const totals: UsageReport['totals'] = {
    costUsd: 0,
    subagentCostUsd: 0,
    uncachedCostUsd: 0,
    tokens: zeroTokens(),
    calls: 0,
    sessions: 0,
    subagentRuns: 0,
    toolCalls: 0,
    skillCalls: 0,
  };
  const bucket: Bucket = range === 'today' ? 'hour' : 'day';
  const timeline = emptyTimeline(since, now, bucket);
  const models = new Map<string, UsageModel>();
  const sessions = new Map<string, SessionAcc>();
  const skills = new Map<string, UsageSkill & { sessionIds: Set<string>; sizes: number[] }>();
  const subagents = new Map<string, UsageSubagent>();
  const tools = new Map<string, UsageTool>();

  const sessionFor = (file: TranscriptFile): SessionAcc =>
    bump(sessions, file.sessionId, () => ({
      lastContextAt: 0,
      session: {
        id: file.sessionId,
        title: null,
        cwd: file.cwd ?? '',
        model: null,
        costUsd: 0,
        subagentCostUsd: 0,
        tokens: zeroTokens(),
        calls: 0,
        contextTokens: 0,
        peakContextTokens: 0,
        contextWindow: contextWindowFor(null),
        compactions: 0,
        subagentRuns: 0,
        toolCalls: 0,
        skillCalls: 0,
        startedAt: Number.POSITIVE_INFINITY,
        lastAt: 0,
      },
    }));
  const subagentFor = (type: string): UsageSubagent =>
    bump(subagents, type, () => ({
      type,
      runs: 0,
      costUsd: 0,
      tokens: zeroTokens(),
      calls: 0,
      toolCalls: 0,
      lastAt: 0,
    }));

  for (const file of files) {
    const messages = file.messages.filter((m) => inRange(m.at));
    const fileTools = file.tools.filter((t) => inRange(t.at));
    const fileSkills = file.skills.filter((s) => inRange(s.at));
    const runs = file.agentRuns.filter((r) => inRange(r.at));
    const compactions = file.compactions.filter(inRange).length;
    if (messages.length === 0 && fileTools.length === 0 && fileSkills.length === 0) continue;

    const acc = sessionFor(file);
    const s = acc.session;
    if (!file.subagent) {
      if (file.title !== null) s.title = file.title;
      if (file.cwd !== null) s.cwd = file.cwd;
    } else if (s.cwd === '' && file.cwd !== null) {
      s.cwd = file.cwd;
    }
    s.compactions += compactions;
    s.subagentRuns += runs.length;
    s.toolCalls += fileTools.length;
    s.skillCalls += fileSkills.length;
    totals.subagentRuns += runs.length;
    totals.toolCalls += fileTools.length;
    totals.skillCalls += fileSkills.length;
    for (const run of runs) {
      const sub = subagentFor(run.type);
      sub.runs += 1;
      sub.lastAt = Math.max(sub.lastAt, run.at);
    }

    // A subagent file has its kind; an older transcript keeps subagents inline, kind unknown.
    const subagentType = file.subagent ? (file.agentType ?? 'subagent') : 'subagent';
    for (const m of messages) {
      const cost = m.costUsd ?? 0;
      const tokens = requestTokens(m);
      totals.costUsd += cost;
      totals.uncachedCostUsd += m.uncachedUsd ?? 0;
      totals.calls += 1;
      addTokens(totals.tokens, m);

      const model = baseModel(m.model);
      const byModel = bump(models, model, () => ({
        model,
        costUsd: 0,
        tokens: zeroTokens(),
        calls: 0,
        unpriced: false,
      }));
      byModel.costUsd += cost;
      byModel.calls += 1;
      if (m.costUsd === null) byModel.unpriced = true;
      addTokens(byModel.tokens, m);

      const point = timeline.get(bucketStart(m.at, bucket));
      if (point !== undefined) {
        point.costUsd += cost;
        point.tokens += tokens;
        point.calls += 1;
        if (m.sidechain) point.subagentCostUsd += cost;
      }

      s.costUsd += cost;
      s.calls += 1;
      addTokens(s.tokens, m);
      s.startedAt = Math.min(s.startedAt, m.at);
      s.lastAt = Math.max(s.lastAt, m.at);
      if (m.sidechain) {
        s.subagentCostUsd += cost;
        totals.subagentCostUsd += cost;
        const sub = subagentFor(subagentType);
        sub.costUsd += cost;
        sub.calls += 1;
        sub.lastAt = Math.max(sub.lastAt, m.at);
        addTokens(sub.tokens, m);
      } else {
        s.peakContextTokens = Math.max(s.peakContextTokens, m.context);
        if (m.at >= acc.lastContextAt) {
          acc.lastContextAt = m.at;
          s.contextTokens = m.context;
          s.model = model;
          s.contextWindow = contextWindowFor(model);
        }
      }
    }

    for (const t of fileTools) {
      s.lastAt = Math.max(s.lastAt, t.at);
      s.startedAt = Math.min(s.startedAt, t.at);
      const tool = bump(tools, t.name, () => ({
        name: t.name,
        server: mcpServer(t.name),
        calls: 0,
        bySubagents: 0,
      }));
      tool.calls += 1;
      if (t.sidechain) {
        tool.bySubagents += 1;
        subagentFor(subagentType).toolCalls += 1;
      }
    }

    for (const k of fileSkills) {
      const skill = bump(skills, k.name, () => ({
        name: k.name,
        calls: 0,
        byYou: 0,
        sessions: 0,
        approxTokens: 0,
        lastAt: 0,
        sessionIds: new Set<string>(),
        sizes: [],
      }));
      skill.calls += 1;
      if (k.byYou) skill.byYou += 1;
      skill.sessionIds.add(file.sessionId);
      if (k.chars !== null) skill.sizes.push(k.chars);
      skill.lastAt = Math.max(skill.lastAt, k.at);
    }
  }

  const sessionList = [...sessions.values()]
    .map((a) => a.session)
    .filter((s) => s.lastAt > 0)
    .map((s) => ({
      ...s,
      startedAt: Number.isFinite(s.startedAt) ? s.startedAt : s.lastAt,
    }))
    .sort((a, b) => b.lastAt - a.lastAt);
  totals.sessions = sessionList.length;

  const projects = new Map<string, UsageProject>();
  for (const s of sessionList) {
    const p = bump(projects, s.cwd, () => ({
      cwd: s.cwd,
      sessions: 0,
      costUsd: 0,
      tokens: 0,
      lastAt: 0,
    }));
    p.sessions += 1;
    p.costUsd += s.costUsd;
    p.tokens += tokenTotal(s.tokens);
    p.lastAt = Math.max(p.lastAt, s.lastAt);
  }

  return {
    range,
    since,
    generatedAt: now,
    available,
    totals,
    timeline: { bucket, points: [...timeline.values()] },
    models: [...models.values()].sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls),
    sessions: sessionList.slice(0, MAX_SESSIONS),
    skills: [...skills.values()]
      .map(({ sessionIds, sizes, ...skill }) => ({
        ...skill,
        sessions: sessionIds.size,
        approxTokens:
          sizes.length === 0
            ? 0
            : Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length / CHARS_PER_TOKEN),
      }))
      .sort((a, b) => b.calls - a.calls || b.lastAt - a.lastAt),
    subagents: [...subagents.values()].sort((a, b) => b.costUsd - a.costUsd || b.runs - a.runs),
    tools: [...tools.values()].sort((a, b) => b.calls - a.calls),
    projects: [...projects.values()].sort((a, b) => b.costUsd - a.costUsd),
  };
}
