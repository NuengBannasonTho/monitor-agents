import { mkdir, mkdtemp, appendFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UsageIndex } from './index.js';
import { baseModel, contextWindowFor, priceRequest } from './pricing.js';
import { buildReport, rangeStart } from './report.js';
import type { ParseContext } from './transcripts.js';
import { newTranscriptFile, parseLine } from './transcripts.js';

const NOW = new Date(2026, 10, 6, 15, 0, 0).getTime();
const iso = (hoursAgo: number) => new Date(NOW - hoursAgo * 3_600_000).toISOString();

const usage = (input: number, output: number, read = 0, write1h = 0) => ({
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: read,
  cache_creation_input_tokens: write1h,
  cache_creation: {
    ephemeral_1h_input_tokens: write1h,
    ephemeral_5m_input_tokens: 0,
  },
  speed: 'standard',
});

function assistant(
  id: string,
  hoursAgo: number,
  content: unknown[],
  u: ReturnType<typeof usage> = usage(10, 100, 1000, 0),
  extra: Record<string, unknown> = {},
) {
  return JSON.stringify({
    type: 'assistant',
    sessionId: 's1',
    cwd: '/w/app',
    timestamp: iso(hoursAgo),
    requestId: `req_${id}`,
    isSidechain: false,
    message: { id, model: 'claude-opus-5-5', usage: u, content },
    ...extra,
  });
}

const user = (content: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: 'user',
    sessionId: 's1',
    timestamp: iso(1),
    message: { content },
    ...extra,
  });

const freshCtx = (): ParseContext => ({
  requests: new Map(),
  toolUses: new Set(),
});

describe('pricing', () => {
  it('matches what Claude Code itself charges for Opus 5.5', () => {
    // A real session's cost-state line: costUSD 195.1221462.
    const priced = priceRequest('claude-opus-5-5', {
      input: 868_416,
      output: 1_598_039,
      cacheRead: 576_601_736,
      cacheWrite5m: 14_935,
      cacheWrite1h: 5_536_585,
    });
    expect(priced.costUsd).toBeCloseTo(195.1221462, 4);
  });

  it('prices the longest matching model, doubles fast mode, and knows no price for others', () => {
    const t = {
      input: 1_000_000,
      output: 0,
      cacheRead: 0,
      cacheWrite5m: 0,
      cacheWrite1h: 0,
    };
    expect(priceRequest('claude-opus-5', t).costUsd).toBe(5);
    expect(priceRequest('claude-opus-5-5', t).costUsd).toBe(4);
    expect(priceRequest('claude-opus-5-5[1m]', t, 'fast').costUsd).toBe(8);
    expect(priceRequest('gpt-9', t).costUsd).toBeNull();
    expect(baseModel('us.anthropic.claude-haiku-4-5-20251001')).toBe('claude-haiku-4-5');
  });

  it('gives the 5 family 1M of context and older models 200K', () => {
    expect(contextWindowFor('claude-opus-5-5')).toBe(1_000_000);
    expect(contextWindowFor('claude-opus-4-6')).toBe(1_000_000);
    expect(contextWindowFor('claude-sonnet-4-5-20250929')).toBe(200_000);
    expect(contextWindowFor('claude-haiku-4-5')).toBe(200_000);
  });
});

describe('parseLine', () => {
  it('counts a response written over several lines once', () => {
    const file = newTranscriptFile('/t/s1.jsonl', 's1', false);
    const ctx = freshCtx();
    parseLine(file, assistant('m1', 1, [{ type: 'thinking' }]), ctx);
    parseLine(
      file,
      assistant('m1', 1, [{ type: 'tool_use', id: 't1', name: 'Bash', input: {} }]),
      ctx,
    );
    expect(file.messages).toHaveLength(1);
    expect(file.messages[0]?.context).toBe(1010);
    expect(file.tools.map((t) => t.name)).toEqual(['Bash']);
    expect(file.cwd).toBe('/w/app');
    // A later `cd` does not move the session to another folder.
    parseLine(file, assistant('m2', 1, []).replace('"cwd":"/w/app"', '"cwd":"/w/app/src"'), ctx);
    expect(file.cwd).toBe('/w/app');
  });

  it('skips Claude Code notices and lines it does not need', () => {
    const file = newTranscriptFile('/t/s1.jsonl', 's1', false);
    const ctx = freshCtx();
    parseLine(
      file,
      JSON.stringify({
        type: 'assistant',
        message: { id: 'x', model: '<synthetic>', usage: usage(1, 1) },
      }),
      ctx,
    );
    parseLine(file, '{"type":"api-request","body":"…"}', ctx);
    parseLine(file, 'not json "type":"assistant"', ctx);
    expect(file.messages).toHaveLength(0);
  });

  it('names skills from the Skill tool and from a /command, not from a reload after compacting', () => {
    const file = newTranscriptFile('/t/s1.jsonl', 's1', false);
    const ctx = freshCtx();
    const body = `Base directory for this skill: /skills/git-workflow\n\n${'x'.repeat(4000)}`;
    parseLine(
      file,
      assistant('m1', 2, [
        {
          type: 'tool_use',
          id: 'tu1',
          name: 'Skill',
          input: { skill: 'git-workflow' },
        },
      ]),
      ctx,
    );
    parseLine(
      file,
      user([{ type: 'text', text: body }], {
        isMeta: true,
        sourceToolUseID: 'tu1',
      }),
      ctx,
    );
    // Typed by you.
    parseLine(
      file,
      user('<command-message>p:audit</command-message>\n<command-name>/p:audit</command-name>'),
      ctx,
    );
    parseLine(
      file,
      user(
        [
          {
            type: 'text',
            text: 'Base directory for this skill: /x/audit\n\nhi',
          },
        ],
        { isMeta: true },
      ),
      ctx,
    );
    // /compact, then the loaded skill put back into the context: not a new use.
    parseLine(file, user('<command-name>/compact</command-name>'), ctx);
    parseLine(file, user([{ type: 'text', text: body }], { isMeta: true }), ctx);

    expect(file.skills.map((s) => [s.name, s.byYou, s.chars])).toEqual([
      ['git-workflow', false, body.length],
      ['p:audit', true, 'Base directory for this skill: /x/audit\n\nhi'.length],
    ]);
  });

  it('records subagent runs by kind, titles and compactions', () => {
    const file = newTranscriptFile('/t/s1.jsonl', 's1', false);
    const ctx = freshCtx();
    parseLine(
      file,
      assistant('m1', 1, [
        {
          type: 'tool_use',
          id: 'a1',
          name: 'Agent',
          input: { subagent_type: 'Explore' },
        },
        { type: 'tool_use', id: 'a2', name: 'Task', input: {} },
      ]),
      ctx,
    );
    parseLine(file, JSON.stringify({ type: 'ai-title', aiTitle: 'Fix login' }), ctx);
    parseLine(
      file,
      JSON.stringify({
        type: 'system',
        subtype: 'compact_boundary',
        timestamp: iso(1),
      }),
      ctx,
    );
    expect(file.agentRuns.map((r) => r.type)).toEqual(['Explore', 'general-purpose']);
    expect(file.title).toBe('Fix login');
    expect(file.compactions).toHaveLength(1);
  });
});

describe('buildReport', () => {
  it('adds up by range, session, model, subagent kind, skill and tool', () => {
    const ctx = freshCtx();
    const main = newTranscriptFile('/t/s1.jsonl', 's1', false);
    const sub = newTranscriptFile('/t/s1/subagents/agent-a.jsonl', 's1', true);
    sub.agentType = 'Explore';
    parseLine(main, assistant('old', 24 * 40, [], usage(1_000_000, 0)), ctx);
    parseLine(
      main,
      assistant(
        'm1',
        2,
        [
          {
            type: 'tool_use',
            id: 'a1',
            name: 'Agent',
            input: { subagent_type: 'Explore' },
          },
        ],
        usage(0, 0, 0, 200_000),
      ),
      ctx,
    );
    parseLine(main, assistant('m2', 1, [], usage(0, 1_000_000, 300_000, 0)), ctx);
    parseLine(
      sub,
      assistant(
        's1m',
        1,
        [
          {
            type: 'tool_use',
            id: 'g1',
            name: 'mcp__github__search',
            input: {},
          },
        ],
        usage(1_000_000, 0),
        { isSidechain: true },
      ),
      ctx,
    );

    const report = buildReport([main, sub], '30d', NOW, true);
    // The 40-day-old request is outside 30 days.
    expect(report.totals.calls).toBe(3);
    // 200K 1h writes at $8/M, 1M output at $20/M, 300K reads at $0.20/M, 1M input at $4/M.
    expect(report.totals.costUsd).toBeCloseTo(1.6 + 20 + 0.06 + 4, 6);
    expect(report.totals.subagentCostUsd).toBeCloseTo(4, 6);

    const session = report.sessions[0];
    expect(session?.contextTokens).toBe(300_000);
    expect(session?.peakContextTokens).toBe(300_000);
    expect(session?.contextWindow).toBe(1_000_000);
    expect(session?.subagentRuns).toBe(1);

    expect(report.subagents).toEqual([
      expect.objectContaining({
        type: 'Explore',
        runs: 1,
        calls: 1,
        toolCalls: 1,
      }),
    ]);
    expect(report.tools.find((t) => t.name === 'mcp__github__search')).toMatchObject({
      server: 'github',
      bySubagents: 1,
    });
    expect(report.models[0]?.model).toBe('claude-opus-5-5');
    expect(report.projects).toEqual([expect.objectContaining({ cwd: '/w/app', sessions: 1 })]);
    expect(report.timeline.bucket).toBe('day');
    expect(report.timeline.points).toHaveLength(30);
    expect(report.timeline.points.at(-1)?.costUsd).toBeCloseTo(25.66, 6);
    expect(report.timeline.points.at(-1)?.subagentCostUsd).toBeCloseTo(4, 6);

    // Today goes by the hour: 1.6 at 13:00, 20.06 + 4 at 14:00.
    const today = buildReport([main, sub], 'today', NOW, true);
    expect(today.timeline.bucket).toBe('hour');
    expect(today.timeline.points).toHaveLength(24);
    expect(today.timeline.points[13]?.costUsd).toBeCloseTo(1.6, 6);
    expect(today.timeline.points[14]?.costUsd).toBeCloseTo(24.06, 6);
  });

  it('starts today at local midnight and 7 days six midnights before', () => {
    expect(new Date(rangeStart('today', NOW)).getHours()).toBe(0);
    expect(new Date(rangeStart('today', NOW)).getDate()).toBe(6);
    expect(new Date(rangeStart('7d', NOW)).getDate()).toBe(31);
  });
});

describe('UsageIndex', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'usage-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('reads transcripts and then only what was appended, leaving a half-written line', async () => {
    let now = Date.now();
    const project = path.join(root, '-w-app');
    await mkdir(path.join(project, 's1', 'subagents'), { recursive: true });
    const transcript = path.join(project, 's1.jsonl');
    const line = (id: string) =>
      JSON.stringify({
        type: 'assistant',
        sessionId: 's1',
        cwd: '/w/app',
        timestamp: new Date(now).toISOString(),
        message: {
          id,
          model: 'claude-opus-5-5',
          usage: usage(10, 10),
          content: [],
        },
      });
    await writeFile(transcript, `${line('m1')}\n${line('m2').slice(0, 30)}`);
    await writeFile(
      path.join(project, 's1', 'subagents', 'agent-x.meta.json'),
      JSON.stringify({ agentType: 'Plan' }),
    );
    await writeFile(path.join(project, 's1', 'subagents', 'agent-x.jsonl'), `${line('sub1')}\n`);

    const index = new UsageIndex({
      roots: () => Promise.resolve([root]),
      now: () => now,
    });
    const first = await index.report('today');
    expect(first.totals.calls).toBe(2);
    expect(first.subagents.map((s) => s.type)).toEqual(['Plan']);

    // The rest of the half-written line, and one more.
    await appendFile(transcript, `${line('m2').slice(30)}\n${line('m3')}\n`);
    now += 5_000;
    const second = await index.report('today');
    expect(second.totals.calls).toBe(4);
    expect(second.sessions).toHaveLength(1);
  });

  it('says so when there is no transcripts folder', async () => {
    const index = new UsageIndex({ roots: () => Promise.resolve([]) });
    const report = await index.report('7d');
    expect(report.available).toBe(false);
    expect(report.totals.calls).toBe(0);
  });
});
