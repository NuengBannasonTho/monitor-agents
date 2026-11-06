import type { Agent } from '@agent-office/shared';
import { useMemo, useState } from 'react';
import { formatSpan, formatSpanShort } from '../../lib/duration';
import { formatRelative } from '../../lib/relative-time';
import { navigate } from '../../lib/route';
import { useNow } from '../../hooks/use-now';
import {
  AgentsIcon,
  CampIcon,
  FinishedIcon,
  NeedsYouIcon,
  STATE_ICON,
  SearchFieldIcon,
  SubagentIcon,
  WorkIcon,
} from '../../components/icons';
import { KindBadge } from '../../components/office/kind-badge';
import { KIND_META } from '../../components/office/kind';
import { STATE_COLOR_VAR, STATE_LABEL } from '../../components/office/state-meta';
import { Card } from '../../components/ui/card';
import type { Column } from '../../components/ui/data-table';
import { DataTable } from '../../components/ui/data-table';
import { Input } from '../../components/ui/input';
import { Page } from '../../components/ui/page';
import type { PageTab } from '../../components/ui/page-tabs';
import { PageTabs } from '../../components/ui/page-tabs';
import { StatCard } from '../../components/ui/stat-card';
import type { AgentFilter } from '../../lib/agent-list';
import { matchesFilter, matchesSearch, shortPath, sortAgents } from '../../lib/agent-list';
import styles from './page.module.css';

interface AgentsPageProps {
  readonly agents: readonly Agent[];
  /** The filter in the URL (the sidebar's Focus items set it); null for all. */
  readonly filter: string | null;
  readonly selectedId: string | null;
  /** Agents with a finished answer you have not opened. */
  readonly finishedIds: ReadonlySet<string>;
  /** Opens an agent's details. */
  readonly onOpen: (id: string) => void;
}

const FILTERS: readonly {
  readonly value: AgentFilter;
  readonly label: string;
}[] = [
  { value: 'all', label: 'All' },
  { value: 'needs-you', label: 'Needs you' },
  { value: 'working', label: 'Working' },
  { value: 'resting', label: 'Resting' },
];

const filterOf = (value: string | null): AgentFilter =>
  FILTERS.find((f) => f.value === value)?.value ?? 'all';

/**
 * Every agent the server sees, as a table to scan rather than a scene to watch: the counts
 * on top, who needs you first. Click a row for its details.
 */
export function AgentsPage({ agents, filter, selectedId, finishedIds, onOpen }: AgentsPageProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const now = useNow(15_000);
  const current = filterOf(filter);

  const sorted = useMemo(() => sortAgents(agents), [agents]);
  const shown = sorted.filter((a) => matchesFilter(a, current) && matchesSearch(a, query));
  const count = (f: AgentFilter) => agents.filter((a) => matchesFilter(a, f)).length;
  const tabs: PageTab<AgentFilter>[] = FILTERS.map((f) => ({
    ...f,
    count: count(f.value),
  }));

  const columns: Column<Agent>[] = [
    {
      key: 'agent',
      header: 'Agent',
      width: '24%',
      cell: (agent) => (
        <span className={styles.agent}>
          <KindBadge kind={agent.kind} size={16} className={styles.kind} />
          <span className={styles.agentText}>
            <span className={styles.desk}>{agent.desk}</span>
            <span className={styles.provider}>{KIND_META[agent.kind].provider}</span>
          </span>
          {finishedIds.has(agent.id) && (
            <span className={styles.unread} title="Finished, not opened yet">
              New
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'state',
      header: 'State',
      width: '160px',
      cell: (agent) => {
        const Icon = STATE_ICON[agent.state];
        return (
          <span className={styles.state}>
            <Icon size={15} style={{ color: STATE_COLOR_VAR[agent.state] }} />
            {STATE_LABEL[agent.state]}
            <span className={styles.muted}>{formatSpanShort(now - agent.stateSince)}</span>
          </span>
        );
      },
    },
    {
      key: 'doing',
      header: 'Now',
      cell: (agent) => {
        const last = agent.activity[agent.activity.length - 1];
        return (
          <span className={styles.doing}>
            {agent.tool !== undefined
              ? `${agent.tool.name} for ${formatSpan(now - agent.tool.since)}`
              : (last?.summary ?? 'Nothing yet')}
          </span>
        );
      },
    },
    {
      key: 'folder',
      header: 'Folder',
      width: '20%',
      wide: true,
      cell: (agent) => (
        <span className={styles.folder} title={agent.cwd}>
          {shortPath(agent.cwd)}
        </span>
      ),
    },
    {
      key: 'helpers',
      header: 'Subagents',
      width: '104px',
      wide: true,
      cell: (agent) => {
        const n = agent.subagents?.length ?? 0;
        return n === 0 ? (
          <span className={styles.muted}>–</span>
        ) : (
          <span className={styles.helpers}>
            <SubagentIcon size={14} />
            {n}
          </span>
        );
      },
    },
    {
      key: 'seen',
      header: 'Seen',
      width: '96px',
      wide: true,
      cell: (agent) => <span className={styles.muted}>{formatRelative(agent.lastSeen, now)}</span>,
    },
  ];

  return (
    <Page
      trail={['Agents']}
      title="Agents"
      subtitle="Every agent the server sees, who needs you first."
    >
      <div className={styles.stats}>
        <StatCard value={agents.length} label="Here now" icon={<AgentsIcon size={15} />} />
        <StatCard
          value={count('needs-you')}
          label="Need you"
          icon={<NeedsYouIcon size={15} />}
          total={agents.length}
          color="var(--state-needs-you)"
        />
        <StatCard
          value={count('working')}
          label="Working"
          icon={<WorkIcon size={15} />}
          total={agents.length}
          color="var(--state-working)"
        />
        <StatCard
          value={finishedIds.size}
          label="Finished, unread"
          icon={<FinishedIcon size={15} />}
          total={agents.length}
          color="var(--state-running)"
        />
      </div>

      <div className={styles.views}>
        <PageTabs
          tabs={tabs}
          value={current}
          onChange={(value) => {
            navigate('agents', value === 'all' ? null : value);
          }}
          label="Show agents"
        />
        <Input
          className={styles.search}
          icon={<SearchFieldIcon size={16} />}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder="Search desk or folder…"
          aria-label="Search agents"
        />
      </div>

      <Card padding="none">
        <DataTable
          label="Agents"
          columns={columns}
          rows={shown}
          rowKey={(a) => a.id}
          selectedKey={selectedId}
          onRowClick={(a) => {
            onOpen(a.id);
          }}
          empty={
            agents.length === 0 ? (
              <span className={styles.empty}>
                <CampIcon size={18} />
                No agents yet. Start one from New task, or run Claude Code in a terminal.
              </span>
            ) : (
              'No agents match.'
            )
          }
        />
      </Card>
    </Page>
  );
}
