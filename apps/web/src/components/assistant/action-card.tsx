import { runsAtOnce, worktreeNameFor } from '@agent-office/shared';
import type { Agent, AssistantAction, OrcaRepo, TaskPlaces } from '@agent-office/shared';
import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import { navigate } from '../../lib/route';
import { handOffTaskDraft } from '../../lib/task-draft';
import { startTask } from '../../api/tasks/tasks.services';
import {
  AgentsIcon,
  AlertsIcon,
  AppearanceIcon,
  CopiedIcon,
  CustomAgentsIcon,
  DarkModeIcon,
  DesktopWalkersIcon,
  EditIcon,
  FailedIcon,
  LightModeIcon,
  NewTaskIcon,
  OfficeIcon,
  SendIcon,
  SoundIcon,
  StartIcon,
  WarningIcon,
} from '../icons';
import { KIND_META } from '../office/kind';
import { STATE_COLOR_VAR, STATE_LABEL } from '../office/state-meta';
import { Button } from '../ui/button';
import { Field } from '../ui/field';
import { Select } from '../ui/select';
import type { ActionDeps, Outcome } from './actions';
import { PAGE_LABEL, SWITCH_LABEL, runAction } from './actions';
import { STYLE_META } from './persona-text';
import styles from './action-card.module.css';

export interface ActionCardProps extends ActionDeps {
  readonly action: AssistantAction;
  /** Undefined until it has been carried out (or tried). */
  readonly outcome: Outcome | undefined;
  readonly onSettled: (outcome: Outcome) => void;
  readonly agents: readonly Agent[];
  readonly places: TaskPlaces | null;
  /** Projects MON MANG thought of, offered first when it was not sure which. */
  readonly matches: readonly OrcaRepo[];
  /** No server: nothing can be carried out. */
  readonly preview: boolean;
}

interface Shell {
  readonly icon: ReactNode;
  readonly title: string;
  readonly danger?: boolean;
  readonly children?: ReactNode;
}

function agentName(agents: readonly Agent[], id: string): Agent | null {
  return agents.find((a) => a.id === id) ?? null;
}

/** One thing MON MANG proposes: what it is, then its button or what became of it. */
export function ActionCard(props: ActionCardProps) {
  const { action, outcome, onSettled, agents, preview } = props;
  const [busy, setBusy] = useState(false);
  const run = async (go: () => Promise<Outcome>) => {
    if (busy) return;
    setBusy(true);
    try {
      onSettled(await go());
    } finally {
      setBusy(false);
    }
  };
  const runIt = () => {
    void run(() => runAction(action, props));
  };

  if (action.type === 'start-task') {
    return <StartTaskCard {...props} action={action} busy={busy} run={run} />;
  }

  let shell: Shell;
  let button: { label: string; icon?: ReactNode; danger?: boolean } | null = null;
  let blocked: string | null = null;
  switch (action.type) {
    case 'send': {
      const agent = agentName(agents, action.agentId);
      shell = {
        icon: <SendIcon size={16} />,
        title: `Write to ${agent?.desk ?? 'an agent'}`,
        children: (
          <>
            {agent !== null && <AgentLine agent={agent} />}
            <blockquote className={styles.quote}>{action.text}</blockquote>
          </>
        ),
      };
      button = { label: 'Send', icon: <SendIcon size={15} /> };
      blocked = agent === null ? 'This agent has left.' : null;
      break;
    }
    case 'stop': {
      const agent = agentName(agents, action.agentId);
      shell = {
        icon: <FailedIcon size={16} />,
        title: `Stop ${agent?.desk ?? 'an agent'}`,
        danger: true,
        children: (
          <>
            {agent !== null && <AgentLine agent={agent} />}
            <p className={styles.detail}>
              Like pressing Esc in its terminal: this turn stops, the session stays open.
            </p>
          </>
        ),
      };
      button = { label: 'Stop', danger: true };
      blocked = agent === null ? 'This agent has left.' : null;
      break;
    }
    case 'open-agent': {
      const agent = agentName(agents, action.agentId);
      shell = {
        icon: <AgentsIcon size={16} />,
        title: `Open ${agent?.desk ?? 'an agent'}`,
        children: agent !== null && <AgentLine agent={agent} />,
      };
      button = { label: 'Open again' };
      blocked = agent === null ? 'This agent has left.' : null;
      break;
    }
    case 'open-page':
      shell = {
        icon: <OfficeIcon size={16} />,
        title: `Go to ${PAGE_LABEL[action.page]}${
          action.section === null ? '' : ` · ${action.section}`
        }`,
      };
      button = { label: 'Open' };
      break;
    case 'theme':
      shell = {
        icon: action.theme === 'dark' ? <DarkModeIcon size={16} /> : <LightModeIcon size={16} />,
        title: `Theme: ${action.theme}`,
      };
      button = { label: 'Apply again' };
      break;
    case 'switch': {
      const Icon =
        action.setting === 'sound'
          ? SoundIcon
          : action.setting === 'alerts'
            ? AlertsIcon
            : DesktopWalkersIcon;
      shell = {
        icon: <Icon size={16} />,
        title: `${SWITCH_LABEL[action.setting]}: ${action.on ? 'on' : 'off'}`,
      };
      button = { label: action.on ? 'Turn on' : 'Turn off' };
      break;
    }
    case 'persona': {
      const parts = [
        action.style === null ? null : STYLE_META[action.style].label,
        action.voice === null ? null : `ending ${action.voice}`,
        action.language === null ? null : `language ${action.language}`,
        action.callMe === null ? null : `calls you “${action.callMe}”`,
        action.emoji === null ? null : action.emoji ? 'with emoji' : 'no emoji',
        action.color,
      ].filter((p) => p !== null);
      shell = {
        icon: <AppearanceIcon size={16} />,
        title: 'New personality',
        children: (
          <p className={styles.detail}>
            {parts.join(' · ') || 'Notes updated'}{' '}
            <Button
              variant="link"
              onClick={() => {
                navigate('settings', 'assistant');
              }}
            >
              Adjust
            </Button>
          </p>
        ),
      };
      button = { label: 'Apply again' };
      break;
    }
    case 'custom-agent':
      shell = {
        icon: <CustomAgentsIcon size={16} />,
        title: `New custom agent: ${action.agent.name}`,
        children: (
          <>
            <p className={styles.detail}>{action.agent.description}</p>
            <dl className={styles.facts}>
              <div>
                <dt>Model</dt>
                <dd>{action.agent.model ?? 'Default'}</dd>
              </div>
              <div>
                <dt>Tools</dt>
                <dd>{action.agent.tools === null ? 'All tools' : action.agent.tools.join(', ')}</dd>
              </div>
              <div>
                <dt>Saved in</dt>
                <dd>~/.claude/agents</dd>
              </div>
            </dl>
            <pre className={styles.prompt}>{action.agent.prompt}</pre>
          </>
        ),
      };
      button = { label: 'Create', icon: <CustomAgentsIcon size={15} /> };
      break;
  }

  return (
    <Card shell={shell} outcome={outcome}>
      {outcome === undefined || !outcome.ok || runsAtOnce(action) ? (
        <Button
          size="sm"
          variant={
            button.danger === true ? 'danger' : outcome === undefined ? 'primary' : 'secondary'
          }
          icon={button.icon}
          disabled={busy || preview || blocked !== null}
          onClick={runIt}
        >
          {busy ? 'Working…' : outcome !== undefined && !outcome.ok ? 'Try again' : button.label}
        </Button>
      ) : null}
      {blocked !== null && <span className={styles.blocked}>{blocked}</span>}
    </Card>
  );
}

function Card({
  shell,
  outcome,
  children,
}: {
  readonly shell: Shell;
  readonly outcome: Outcome | undefined;
  readonly children?: ReactNode;
}) {
  return (
    <div
      className={styles.card}
      data-danger={shell.danger === true || undefined}
      data-state={outcome === undefined ? 'ready' : outcome.ok ? 'done' : 'failed'}
    >
      <header className={styles.head}>
        <span className={styles.icon}>{shell.icon}</span>
        <strong className={styles.title}>{shell.title}</strong>
      </header>
      {shell.children}
      <footer className={styles.foot}>
        {outcome !== undefined && (
          <span className={styles.outcome} data-ok={outcome.ok}>
            {outcome.ok ? <CopiedIcon size={14} /> : <WarningIcon size={14} />}
            {outcome.note}
          </span>
        )}
        {children}
      </footer>
    </div>
  );
}

function AgentLine({ agent }: { readonly agent: Agent }) {
  return (
    <p className={styles.agent}>
      <span
        className={styles.stateDot}
        style={{ background: STATE_COLOR_VAR[agent.state] }}
        aria-hidden
      />
      {KIND_META[agent.kind].label} · {STATE_LABEL[agent.state]} · <span>{agent.cwd}</span>
    </p>
  );
}

/** A task to start: where (asked when MON MANG was not sure), then Start or finish it in New task. */
function StartTaskCard({
  action,
  outcome,
  places,
  matches,
  preview,
  busy,
  run,
}: ActionCardProps & {
  readonly action: Extract<AssistantAction, { type: 'start-task' }>;
  readonly busy: boolean;
  readonly run: (go: () => Promise<Outcome>) => Promise<void>;
}) {
  const id = useId();
  const repos = places?.repos ?? matches;
  const ordered = [
    ...matches.filter((m) => repos.some((r) => r.id === m.id)),
    ...repos.filter((r) => !matches.some((m) => m.id === r.id)),
  ];
  const [repoId, setRepoId] = useState(action.repoId ?? matches[0]?.id ?? '');
  const [name] = useState(
    () => `${worktreeNameFor(action.task).slice(0, 48)}-${Date.now().toString(36).slice(-4)}`,
  );
  const worktree =
    action.worktreeId === null
      ? null
      : (places?.worktrees.find((w) => w.id === action.worktreeId) ?? null);
  const repo = repos.find((r) => r.id === (worktree?.repoId ?? repoId)) ?? null;
  const agentLabel = action.provider === 'codex' ? 'Codex' : 'Claude Code';
  const blocked = preview
    ? 'Starting agents needs the server.'
    : places === null
      ? 'Loading where it can run…'
      : !places.enabled
        ? 'Starting agents is off (START_AGENTS=off).'
        : !places.reachable
          ? 'Orca is not reachable. Open the Orca app first.'
          : repo === null
            ? 'Pick a project.'
            : null;

  const start = () => {
    void run(async () => {
      const result = await startTask({
        provider: action.provider,
        task: action.task,
        where:
          worktree !== null
            ? { kind: 'existing', worktreeId: worktree.id }
            : { kind: 'new', repoId: repo?.id ?? '', name },
        team: [...action.team],
      });
      if (!result.ok) return { ok: false, note: result.error };
      const where = result.value === '' ? '' : ` in ${result.value}`;
      return { ok: true, note: `Started ${agentLabel}${where}` };
    });
  };

  return (
    <Card
      shell={{
        icon: <NewTaskIcon size={16} />,
        title: `Start ${agentLabel} on a task`,
        children: (
          <>
            <blockquote className={styles.quote}>{action.task}</blockquote>
            {action.repoId === null && worktree === null && outcome === undefined ? (
              <Field id={`${id}-repo`} label="Project">
                <Select
                  id={`${id}-repo`}
                  value={repoId}
                  placeholder="Choose a project"
                  onChange={setRepoId}
                  options={ordered.map((r) => ({ value: r.id, label: r.name, detail: r.path }))}
                />
              </Field>
            ) : null}
            <dl className={styles.facts}>
              <div>
                <dt>Runs in</dt>
                <dd>
                  {worktree !== null
                    ? `${worktree.name} (existing worktree)`
                    : `${repo?.name ?? '…'} → new worktree ${name}`}
                </dd>
              </div>
              {action.team.length > 0 && (
                <div>
                  <dt>Team</dt>
                  <dd>{action.team.join(', ')}</dd>
                </div>
              )}
            </dl>
          </>
        ),
      }}
      outcome={outcome}
    >
      {outcome?.ok === true ? (
        <Button
          size="sm"
          variant="link"
          onClick={() => {
            navigate('office');
          }}
        >
          View office
        </Button>
      ) : (
        <>
          <Button
            size="sm"
            icon={<EditIcon size={15} />}
            disabled={busy}
            onClick={() => {
              handOffTaskDraft({
                provider: action.provider,
                task: action.task,
                repoId: repo?.id ?? null,
                worktreeId: worktree?.id ?? null,
                team: action.team,
              });
              navigate('new-task');
            }}
          >
            Edit in New task
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<StartIcon size={15} />}
            disabled={busy || blocked !== null}
            title={blocked ?? undefined}
            onClick={start}
          >
            {busy ? 'Starting…' : outcome === undefined ? 'Start' : 'Try again'}
          </Button>
        </>
      )}
      {blocked !== null && outcome === undefined && (
        <span className={styles.blocked}>{blocked}</span>
      )}
    </Card>
  );
}
