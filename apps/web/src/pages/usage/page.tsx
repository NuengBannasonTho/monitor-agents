import { tokenTotal } from '@agent-office/shared';
import type {
  Agent,
  UsageProject,
  UsageRange,
  UsageReport,
  UsageSession,
  UsageSkill,
  UsageSubagent,
  UsageTool,
} from '@agent-office/shared';
import { useMemo, useState } from 'react';
import { formatDay, formatShare, formatTokens, formatUsd, plural } from '../../lib/format';
import { formatRelative } from '../../lib/relative-time';
import { navigate } from '../../lib/route';
import { useNow } from '../../hooks/use-now';
import { useAccount } from '../../api/account/account.hooks';
import { useUsage } from '../../api/usage/usage.hooks';
import { sampleUsageReport } from '../../mock/usage-sample';
import { shortPath } from '../../lib/agent-list';
import {
  AgentsIcon,
  ContextIcon,
  CostIcon,
  FolderIcon,
  ModelIcon,
  ReloadIcon,
  SkillIcon,
  SubagentIcon,
  TokensIcon,
  ToolIcon,
  UsageIcon,
  WarningIcon,
} from '../../components/icons';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import type { ChartColumn, ChartSeries } from '../../components/ui/column-chart';
import { ColumnChart } from '../../components/ui/column-chart';
import type { Column } from '../../components/ui/data-table';
import { DataTable } from '../../components/ui/data-table';
import { Meter } from '../../components/ui/meter';
import { Page } from '../../components/ui/page';
import type { PageTab } from '../../components/ui/page-tabs';
import { PageTabs } from '../../components/ui/page-tabs';
import { ShareBar } from '../../components/ui/share-bar';
import { StatCard } from '../../components/ui/stat-card';
import type { TabOption } from '../../components/ui/tabs';
import { Tabs } from '../../components/ui/tabs';
import { modelLabel } from './model-label';
import styles from './page.module.css';

type View = 'sessions' | 'skills' | 'subagents' | 'tools' | 'projects';
const VIEWS: readonly View[] = ['sessions', 'skills', 'subagents', 'tools', 'projects'];
const viewOf = (value: string | null): View => VIEWS.find((v) => v === value) ?? 'sessions';

const RANGES: readonly TabOption<UsageRange>[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];
const RANGE_KEY = 'agent-office:usage-range:v1';

function readRange(): UsageRange {
  try {
    const saved = window.localStorage.getItem(RANGE_KEY);
    return RANGES.find((r) => r.value === saved)?.value ?? 'today';
  } catch {
    return 'today';
  }
}

/** The range you looked at last, remembered in this browser. */
function useRange(): [UsageRange, (next: UsageRange) => void] {
  const [range, setRange] = useState(readRange);
  const choose = (next: UsageRange) => {
    setRange(next);
    try {
      window.localStorage.setItem(RANGE_KEY, next);
    } catch {
      // Storage blocked: the choice lasts until reload.
    }
  };
  return [range, choose];
}

const SERIES: readonly ChartSeries[] = [
  { key: 'main', name: 'Main agents', color: 'var(--series-1)' },
  { key: 'subagents', name: 'Subagents', color: 'var(--series-2)' },
];

function timelineColumns(report: UsageReport): ChartColumn[] {
  const { bucket, points } = report.timeline;
  // Enough labels to read the axis without them running into each other.
  const every = bucket === 'hour' ? 3 : points.length > 10 ? 5 : 1;
  return points.map((p, i) => {
    const d = new Date(p.at);
    const day = `${String(d.getFullYear())}-${String(d.getMonth() + 1)}-${String(d.getDate())}`;
    const hour = `${String(d.getHours()).padStart(2, '0')}:00`;
    const last = i === points.length - 1;
    return {
      key: String(p.at),
      axisLabel:
        i % every === 0 || (bucket === 'day' && last)
          ? bucket === 'hour'
            ? String(d.getHours()).padStart(2, '0')
            : formatDay(day)
          : null,
      title:
        bucket === 'hour'
          ? `${hour}–${String(d.getHours() + 1).padStart(2, '0')}:00`
          : formatDay(day, { weekday: 'short' }),
      values: {
        main: Math.max(0, p.costUsd - p.subagentCostUsd),
        subagents: p.subagentCostUsd,
      },
    };
  });
}

interface UsagePageProps {
  /** The view below the summary, from the URL (?section=skills). */
  readonly section: string | null;
  /** Agents in the office now: their sessions are marked live and open their drawer. */
  readonly agents: readonly Agent[];
  readonly onOpen: (id: string) => void;
  /** The static preview has no server: it shows made-up numbers. */
  readonly preview: boolean;
}

/**
 * What the agents used, to keep an eye on the work: an estimated cost at API prices over
 * time, how full each session's context is, and which skills, subagents and tools did the
 * work, from Claude Code's own transcripts on this machine.
 */
export function UsagePage({ section, agents, onOpen, preview }: UsagePageProps) {
  const [range, setRange] = useRange();
  const { state, reload } = useUsage(preview ? null : range);
  const now = useNow(30_000);
  const sample = useMemo(
    () => (preview ? sampleUsageReport(range, now) : null),
    [preview, range, now],
  );
  const report = sample ?? (state.status === 'ready' ? state.report : null);
  const view = viewOf(section);
  const live = useMemo(() => new Set(agents.map((a) => a.id)), [agents]);
  const account = useAccount(!preview);

  const actions = (
    <>
      <Tabs options={RANGES} value={range} onChange={setRange} label="Range" />
      <Button
        size="sm"
        iconOnly
        icon={<ReloadIcon size={16} />}
        aria-label="Refresh"
        title="Refresh"
        onClick={reload}
        disabled={preview}
      />
    </>
  );

  return (
    <Page
      trail={['Usage']}
      title="Usage"
      subtitle="What your agents used, read from Claude Code's transcripts on this machine. Costs are estimates at API list prices: on a Claude plan you pay the plan, not per token."
      actions={actions}
    >
      {preview && (
        <p className={styles.notice}>
          <WarningIcon size={16} />
          The preview has no server: these numbers are made up.
        </p>
      )}
      {report === null ? (
        <Card>
          <p className={styles.muted}>
            {state.status === 'error' ? state.error : 'Reading the transcripts…'}
          </p>
        </Card>
      ) : !report.available ? (
        <Card>
          <p className={styles.muted}>
            No Claude Code transcripts found (looked in ~/.claude/projects and $CLAUDE_CONFIG_DIR).
          </p>
        </Card>
      ) : (
        <Report
          report={report}
          stale={report.range !== range}
          view={view}
          now={now}
          live={live}
          onOpen={onOpen}
          account={account}
        />
      )}
    </Page>
  );
}

interface ReportProps {
  readonly report: UsageReport;
  /** Still the previous range's numbers while the new range loads. */
  readonly stale: boolean;
  readonly view: View;
  readonly now: number;
  readonly live: ReadonlySet<string>;
  readonly onOpen: (id: string) => void;
  readonly account: ReturnType<typeof useAccount>;
}

function Report({ report, stale, view, now, live, onOpen, account }: ReportProps) {
  const { totals } = report;
  const tokens = tokenTotal(totals.tokens);
  const saved = Math.max(0, totals.uncachedCostUsd - totals.costUsd);
  const columns = useMemo(() => timelineColumns(report), [report]);
  const promptTokens = totals.tokens.input + totals.tokens.cacheRead + totals.tokens.cacheWrite;
  const session = account?.usage.session ?? null;
  const weekly = account?.usage.weekly ?? null;

  const tabs: PageTab<View>[] = [
    { value: 'sessions', label: 'Sessions', count: report.sessions.length },
    { value: 'skills', label: 'Skills', count: report.skills.length },
    { value: 'subagents', label: 'Subagents', count: report.subagents.length },
    { value: 'tools', label: 'Tools', count: report.tools.length },
    { value: 'projects', label: 'Projects', count: report.projects.length },
  ];

  return (
    <div className={styles.report} data-stale={stale || undefined}>
      <div className={styles.stats}>
        <StatCard
          value={totals.costUsd}
          display={formatUsd(totals.costUsd)}
          label="Estimated cost"
          icon={<CostIcon size={15} />}
          detail={`${formatUsd(totals.subagentCostUsd)} by subagents`}
        />
        <StatCard
          value={tokens}
          display={formatTokens(tokens)}
          label="Tokens"
          icon={<TokensIcon size={15} />}
          detail={`${formatTokens(totals.tokens.output)} written by Claude`}
        />
        <StatCard
          value={totals.calls}
          display={totals.calls.toLocaleString('en-US')}
          label="Requests to Claude"
          icon={<UsageIcon size={15} />}
          detail={`${plural(totals.sessions, 'session')} · ${plural(totals.subagentRuns, 'subagent')}`}
        />
        <StatCard
          value={saved}
          display={formatUsd(saved)}
          label="Saved by caching"
          icon={<ContextIcon size={15} />}
          total={totals.uncachedCostUsd}
          color="var(--state-running)"
          detail={`${formatShare(totals.tokens.cacheRead, promptTokens)} of the context came from cache`}
        />
      </div>

      <div className={styles.overview}>
        <Card className={styles.chartCard}>
          <header className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Estimated cost</h2>
            <span className={styles.muted}>
              {report.timeline.bucket === 'hour' ? 'by the hour, today' : 'by day'}
            </span>
          </header>
          {totals.calls === 0 ? (
            <p className={styles.muted}>Nothing used in this range.</p>
          ) : (
            <ColumnChart
              series={SERIES}
              columns={columns}
              format={formatUsd}
              label="Estimated cost over time, main agents and subagents"
            />
          )}
        </Card>

        <Card className={styles.side}>
          <section className={styles.block}>
            <h2 className={styles.cardTitle}>Claude plan</h2>
            {session === null && weekly === null ? (
              <p className={styles.muted}>
                {account?.usage.error ?? 'Orca has no plan numbers yet.'}
              </p>
            ) : (
              <>
                {session !== null && (
                  <Meter
                    label="This session (5 hours)"
                    percent={session.usedPercent}
                    detail={session.resets === null ? undefined : `Resets ${session.resets}`}
                  />
                )}
                {weekly !== null && (
                  <Meter
                    label="This week"
                    percent={weekly.usedPercent}
                    detail={weekly.resets === null ? undefined : `Resets ${weekly.resets}`}
                  />
                )}
              </>
            )}
          </section>

          <section className={styles.block}>
            <h2 className={styles.cardTitle}>Models</h2>
            {report.models.length === 0 ? (
              <p className={styles.muted}>None in this range.</p>
            ) : (
              <ul className={styles.list}>
                {report.models.map((m) => (
                  <li key={m.model} className={styles.listRow}>
                    <span className={styles.listName}>
                      <ModelIcon size={14} />
                      {modelLabel(m.model)}
                    </span>
                    <ShareBar
                      label={m.unpriced ? 'no price' : formatUsd(m.costUsd)}
                      note={`${formatShare(m.costUsd, totals.costUsd)} · ${m.calls.toLocaleString('en-US')} req`}
                      value={m.costUsd}
                      max={report.models[0]?.costUsd ?? 0}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.block}>
            <h2 className={styles.cardTitle}>Tokens by kind</h2>
            <ul className={styles.list}>
              {(
                [
                  ['Read from cache', totals.tokens.cacheRead],
                  ['Written to cache', totals.tokens.cacheWrite],
                  ['Written by Claude', totals.tokens.output],
                  ['Sent fresh', totals.tokens.input],
                ] as const
              ).map(([name, value]) => (
                <li key={name} className={styles.listRow}>
                  <span className={styles.listName}>{name}</span>
                  <ShareBar
                    label={formatTokens(value)}
                    note={formatShare(value, tokens)}
                    value={value}
                    max={tokens}
                  />
                </li>
              ))}
            </ul>
          </section>
        </Card>
      </div>

      <PageTabs
        tabs={tabs}
        value={view}
        onChange={(next) => {
          navigate('usage', next === 'sessions' ? null : next);
        }}
        label="Usage details"
      />
      {view === 'sessions' && (
        <SessionsTable report={report} now={now} live={live} onOpen={onOpen} />
      )}
      {view === 'skills' && <SkillsTable skills={report.skills} now={now} />}
      {view === 'subagents' && <SubagentsTable report={report} now={now} />}
      {view === 'tools' && <ToolsTable tools={report.tools} total={totals.toolCalls} />}
      {view === 'projects' && <ProjectsTable report={report} now={now} />}
    </div>
  );
}

function SessionsTable({
  report,
  now,
  live,
  onOpen,
}: {
  readonly report: UsageReport;
  readonly now: number;
  readonly live: ReadonlySet<string>;
  readonly onOpen: (id: string) => void;
}) {
  const maxCost = Math.max(0, ...report.sessions.map((s) => s.costUsd));
  const columns: Column<UsageSession>[] = [
    {
      key: 'session',
      header: 'Session',
      cell: (s) => (
        <span className={styles.stacked}>
          <span className={styles.name}>
            {s.title ?? 'Untitled session'}
            {live.has(s.id) && <span className={styles.live}>In the office</span>}
          </span>
          <span className={styles.path} title={s.cwd}>
            {shortPath(s.cwd)}
          </span>
        </span>
      ),
    },
    {
      key: 'context',
      header: 'Context now',
      width: '22%',
      cell: (s) => (
        <Meter
          label={`${formatTokens(s.contextTokens)} of ${formatTokens(s.contextWindow)}`}
          percent={(s.contextTokens / s.contextWindow) * 100}
          detail={`Peak ${formatTokens(s.peakContextTokens)}${s.compactions > 0 ? ` · compacted ${String(s.compactions)}×` : ''}`}
        />
      ),
    },
    {
      key: 'model',
      header: 'Model',
      width: '110px',
      wide: true,
      cell: (s) => (
        <span className={styles.muted}>{s.model === null ? '–' : modelLabel(s.model)}</span>
      ),
    },
    {
      key: 'cost',
      header: 'Est. cost',
      width: '16%',
      cell: (s) => (
        <ShareBar
          label={formatUsd(s.costUsd)}
          note={s.subagentCostUsd > 0 ? `${formatUsd(s.subagentCostUsd)} subagents` : undefined}
          value={s.costUsd}
          max={maxCost}
        />
      ),
    },
    {
      key: 'work',
      header: 'Work',
      width: '190px',
      wide: true,
      cell: (s) => (
        <span className={styles.stacked}>
          <span>{plural(s.calls, 'request')}</span>
          <span className={styles.counts}>
            <span>{plural(s.toolCalls, 'tool')}</span>
            <span>{plural(s.skillCalls, 'skill')}</span>
            <span>{plural(s.subagentRuns, 'subagent')}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'last',
      header: 'Last',
      width: '100px',
      wide: true,
      cell: (s) => <span className={styles.muted}>{formatRelative(s.lastAt, now)}</span>,
    },
  ];
  return (
    <Card padding="none">
      <DataTable
        label="Sessions"
        columns={columns}
        rows={report.sessions}
        rowKey={(s) => s.id}
        onRowClick={(s) => {
          if (live.has(s.id)) onOpen(s.id);
        }}
        empty="No sessions in this range."
      />
    </Card>
  );
}

function SkillsTable({
  skills,
  now,
}: {
  readonly skills: readonly UsageSkill[];
  readonly now: number;
}) {
  const maxCalls = Math.max(0, ...skills.map((s) => s.calls));
  const maxLoaded = Math.max(0, ...skills.map((s) => s.calls * s.approxTokens));
  const columns: Column<UsageSkill>[] = [
    {
      key: 'skill',
      header: 'Skill',
      cell: (s) => (
        <span className={styles.stacked}>
          <span className={styles.name}>
            <SkillIcon size={14} />
            {s.name}
          </span>
          <span className={styles.muted}>
            {s.byYou === s.calls
              ? 'You typed it'
              : s.byYou === 0
                ? 'Claude chose it'
                : `You typed it ${String(s.byYou)}×, Claude chose it ${String(s.calls - s.byYou)}×`}
          </span>
        </span>
      ),
    },
    {
      key: 'uses',
      header: 'Uses',
      width: '18%',
      cell: (s) => (
        <ShareBar
          label={s.calls}
          note={`in ${plural(s.sessions, 'session')}`}
          value={s.calls}
          max={maxCalls}
        />
      ),
    },
    {
      key: 'size',
      header: 'Size',
      width: '150px',
      cell: (s) =>
        s.approxTokens === 0 ? (
          <span className={styles.muted}>–</span>
        ) : (
          <span className={styles.nowrap}>≈ {formatTokens(s.approxTokens)} tokens</span>
        ),
    },
    {
      key: 'loaded',
      header: 'Added to context',
      width: '20%',
      cell: (s) =>
        s.approxTokens === 0 ? (
          <span className={styles.muted}>–</span>
        ) : (
          <ShareBar
            label={`≈ ${formatTokens(s.calls * s.approxTokens)}`}
            value={s.calls * s.approxTokens}
            max={maxLoaded}
          />
        ),
    },
    {
      key: 'last',
      header: 'Last used',
      width: '96px',
      wide: true,
      cell: (s) => <span className={styles.muted}>{formatRelative(s.lastAt, now)}</span>,
    },
  ];
  return (
    <Card padding="none">
      <p className={styles.tableNote}>
        A skill&apos;s instructions join the context when it loads and are read again with every
        later request of that session, so a big skill costs more than its one use.
      </p>
      <DataTable
        label="Skills"
        columns={columns}
        rows={skills}
        rowKey={(s) => s.name}
        empty="No skills used in this range."
      />
    </Card>
  );
}

function SubagentsTable({ report, now }: { readonly report: UsageReport; readonly now: number }) {
  const rows = report.subagents;
  const maxCost = Math.max(0, ...rows.map((s) => s.costUsd));
  const columns: Column<UsageSubagent>[] = [
    {
      key: 'type',
      header: 'Kind',
      cell: (s) => (
        <span className={styles.name}>
          <SubagentIcon size={14} />
          {s.type}
        </span>
      ),
    },
    {
      key: 'runs',
      header: 'Runs',
      width: '80px',
      cell: (s) => <span className={styles.number}>{s.runs}</span>,
    },
    {
      key: 'cost',
      header: 'Est. cost',
      width: '22%',
      cell: (s) => (
        <ShareBar
          label={formatUsd(s.costUsd)}
          note={formatShare(s.costUsd, report.totals.subagentCostUsd)}
          value={s.costUsd}
          max={maxCost}
        />
      ),
    },
    {
      key: 'per-run',
      header: 'Per run',
      width: '100px',
      cell: (s) => <span>{s.runs === 0 ? '–' : formatUsd(s.costUsd / s.runs)}</span>,
    },
    {
      key: 'tokens',
      header: 'Tokens',
      width: '100px',
      wide: true,
      cell: (s) => <span>{formatTokens(tokenTotal(s.tokens))}</span>,
    },
    {
      key: 'work',
      header: 'Work',
      width: '170px',
      wide: true,
      cell: (s) => (
        <span className={styles.muted}>
          {plural(s.calls, 'request')} · {plural(s.toolCalls, 'tool')}
        </span>
      ),
    },
    {
      key: 'last',
      header: 'Last',
      width: '100px',
      wide: true,
      cell: (s) => (
        <span className={styles.muted}>{s.lastAt === 0 ? '–' : formatRelative(s.lastAt, now)}</span>
      ),
    },
  ];
  return (
    <Card padding="none">
      <DataTable
        label="Subagents"
        columns={columns}
        rows={rows}
        rowKey={(s) => s.type}
        empty="No subagents in this range."
      />
    </Card>
  );
}

function ToolsTable({
  tools,
  total,
}: {
  readonly tools: readonly UsageTool[];
  readonly total: number;
}) {
  const maxCalls = tools[0]?.calls ?? 0;
  const columns: Column<UsageTool>[] = [
    {
      key: 'tool',
      header: 'Tool',
      cell: (t) => (
        <span className={styles.name}>
          <ToolIcon size={14} />
          <span className={styles.code}>
            {t.server === null ? t.name : t.name.replace(/^mcp__.+?__/, '')}
          </span>
          {t.server !== null && <span className={styles.badge}>MCP · {t.server}</span>}
        </span>
      ),
    },
    {
      key: 'calls',
      header: 'Calls',
      width: '26%',
      cell: (t) => (
        <ShareBar
          label={t.calls.toLocaleString('en-US')}
          note={formatShare(t.calls, total)}
          value={t.calls}
          max={maxCalls}
        />
      ),
    },
    {
      key: 'subagents',
      header: 'By subagents',
      width: '130px',
      wide: true,
      cell: (t) => (
        <span className={styles.muted}>{t.bySubagents === 0 ? '–' : t.bySubagents}</span>
      ),
    },
  ];
  return (
    <Card padding="none">
      <DataTable
        label="Tools"
        columns={columns}
        rows={tools}
        rowKey={(t) => t.name}
        empty="No tool calls in this range."
      />
    </Card>
  );
}

function ProjectsTable({ report, now }: { readonly report: UsageReport; readonly now: number }) {
  const rows = report.projects;
  const maxCost = rows[0]?.costUsd ?? 0;
  const columns: Column<UsageProject>[] = [
    {
      key: 'project',
      header: 'Folder',
      cell: (p) => (
        <span className={styles.name} title={p.cwd}>
          <FolderIcon size={14} />
          <span className={styles.code}>{p.cwd === '' ? 'Unknown' : shortPath(p.cwd)}</span>
        </span>
      ),
    },
    {
      key: 'sessions',
      header: 'Sessions',
      width: '100px',
      cell: (p) => (
        <span className={styles.name}>
          <AgentsIcon size={14} />
          {p.sessions}
        </span>
      ),
    },
    {
      key: 'cost',
      header: 'Est. cost',
      width: '26%',
      cell: (p) => (
        <ShareBar
          label={formatUsd(p.costUsd)}
          note={formatShare(p.costUsd, report.totals.costUsd)}
          value={p.costUsd}
          max={maxCost}
        />
      ),
    },
    {
      key: 'tokens',
      header: 'Tokens',
      width: '100px',
      wide: true,
      cell: (p) => <span>{formatTokens(p.tokens)}</span>,
    },
    {
      key: 'last',
      header: 'Last',
      width: '100px',
      wide: true,
      cell: (p) => <span className={styles.muted}>{formatRelative(p.lastAt, now)}</span>,
    },
  ];
  return (
    <Card padding="none">
      <DataTable
        label="Projects"
        columns={columns}
        rows={rows}
        rowKey={(p) => p.cwd}
        empty="No projects in this range."
      />
    </Card>
  );
}
