import { leadPrompt, worktreeNameFor, WORKTREE_NAME_PATTERN } from '@agent-office/shared';
import type { CustomAgent, CustomAgentList, TaskPlaces } from '@agent-office/shared';
import { useEffect, useId, useState } from 'react';
import { navigate } from '../../lib/route';
import { clearTaskDraft, peekTaskDraft } from '../../lib/task-draft';
import { fetchCustomAgents } from '../../api/custom-agents/custom-agents.services';
import { fetchTaskPlaces, startTask } from '../../api/tasks/tasks.services';
import { COLOR_HEX } from '../../lib/agent-colors';
import { CustomAgentsIcon, FolderIcon, SendIcon, WarningIcon } from '../../components/icons';
import type { TabOption } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { Page } from '../../components/ui/page';
import { Select } from '../../components/ui/select';
import { Tabs } from '../../components/ui/tabs';
import { Textarea } from '../../components/ui/textarea';
import { Wizard } from '../../components/ui/wizard';
import styles from './page.module.css';

type Where = 'new' | 'existing';
type Provider = 'claude' | 'codex';

const PROVIDER_TABS: readonly TabOption<Provider>[] = [
  {
    value: 'claude',
    label: 'Claude Code',
    hint: 'Can hand subtasks to saved custom agents',
  },
  { value: 'codex', label: 'Codex', hint: 'Starts a new Codex agent in Orca' },
];

const WHERE_TABS: readonly TabOption<Where>[] = [
  {
    value: 'new',
    label: 'New worktree',
    hint: 'Its own branch and folder: your other work stays as it is',
  },
  {
    value: 'existing',
    label: 'Existing worktree',
    hint: 'Work in a checkout Orca already has',
  },
];

const LAST_REPO_KEY = 'agent-office:task-repo:v1';

function lastRepo(): string | null {
  try {
    return window.localStorage.getItem(LAST_REPO_KEY);
  } catch {
    return null;
  }
}

function rememberRepo(id: string): void {
  try {
    window.localStorage.setItem(LAST_REPO_KEY, id);
  } catch {
    // Storage blocked: the choice is not remembered.
  }
}

type Status =
  | { readonly kind: 'idle' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'started'; readonly where: string };

/**
 * Hand work off: say what should get done, where, and (optionally) which custom agents help.
 * Orca starts Claude Code on it; the agent then shows up in the office like any other.
 */
export function NewTaskPage({
  preview,
  helper,
}: {
  readonly preview: boolean;
  readonly helper?: string | null;
}): React.JSX.Element {
  const [places, setPlaces] = useState<TaskPlaces | null>(null);
  const [helpers, setHelpers] = useState<CustomAgentList | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // A task MON MANG drafted, to finish here.
  const [draft] = useState(peekTaskDraft);
  useEffect(() => {
    clearTaskDraft();
  }, []);
  const [task, setTask] = useState(draft?.task ?? '');
  const [provider, setProvider] = useState<Provider>(
    draft?.provider ?? (helper === '@provider:codex' ? 'codex' : 'claude'),
  );
  const [repoId, setRepoId] = useState<string | null>(() => draft?.repoId ?? lastRepo());
  const [where, setWhere] = useState<Where>(
    draft !== null && draft.worktreeId !== null ? 'existing' : 'new',
  );
  const [name, setName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [worktreeId, setWorktreeId] = useState<string | null>(draft?.worktreeId ?? null);
  const [team, setTeam] = useState<readonly string[]>(draft?.team ?? []);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  // Each started task opens a fresh wizard at step one.
  const [runs, setRuns] = useState(0);
  const id = useId();

  useEffect(() => {
    if (preview) return;
    let live = true;
    void Promise.all([fetchTaskPlaces(), fetchCustomAgents()]).then(
      ([placesResult, helpersResult]) => {
        if (!live) return;
        if (placesResult.ok) setPlaces(placesResult.value);
        else setLoadError(placesResult.error);
        if (helpersResult.ok) setHelpers(helpersResult.value);
        if (!placesResult.ok || !helpersResult.ok || helper === null || helper === undefined)
          return;
        const selected = helpersResult.value.agents.find(
          (agent) => `${agent.scope}\n${agent.file}` === helper && agent.problem === null,
        );
        if (selected === undefined) return;
        setTeam([selected.name]);
        if (selected.scope === 'user') return;
        const folder = selected.scope.slice('project:'.length);
        const worktree = placesResult.value.worktrees.find((item) => item.path === folder);
        if (worktree !== undefined) {
          setRepoId(worktree.repoId);
          setWorktreeId(worktree.id);
          setWhere('existing');
          return;
        }
        const project = placesResult.value.repos.find((repo) => repo.path === folder);
        if (project !== undefined) {
          setRepoId(project.id);
          setWhere('new');
          return;
        }
      },
    );
    return () => {
      live = false;
    };
  }, [preview, helper]);

  const repos = places?.repos ?? [];
  const repo = repos.find((r) => r.id === repoId) ?? repos[0] ?? null;
  const worktrees = (places?.worktrees ?? []).filter((w) => w.repoId === repo?.id);
  const worktree = worktrees.find((w) => w.id === worktreeId) ?? worktrees[0] ?? null;
  // Named after the task until you type a name; nothing yet while the task is empty.
  const branchName = nameEdited ? name : task.trim() === '' ? '' : worktreeNameFor(task);
  const projectDir = where === 'new' ? repo?.path : worktree?.path;

  // Yours, and this project's when an agent here works in it.
  const available: readonly CustomAgent[] = (helpers?.agents ?? []).filter(
    (a) =>
      provider === 'claude' &&
      a.problem === null &&
      (a.scope === 'user' || (projectDir !== undefined && a.scope === `project:${projectDir}`)),
  );
  const members = available.filter((a) => team.includes(a.name));
  const prompt = leadPrompt(task, members);

  const blocked =
    preview || loadError !== null || places === null || !places.enabled || !places.reachable;
  const nameValid = WORKTREE_NAME_PATTERN.test(branchName);
  const ready =
    !blocked &&
    task.trim() !== '' &&
    (where === 'new' ? repo !== null && nameValid : worktree !== null) &&
    status.kind !== 'busy';

  const handleStart = async (): Promise<void> => {
    if (!ready) return;
    setStatus({ kind: 'busy' });
    const result = await startTask({
      provider,
      task,
      where:
        where === 'new'
          ? { kind: 'new', repoId: repo?.id ?? '', name: branchName }
          : { kind: 'existing', worktreeId: worktree?.id ?? '' },
      team: members.map((m) => m.name),
    });
    if (!result.ok) {
      setStatus({ kind: 'error', message: result.error });
      return;
    }
    setStatus({ kind: 'started', where: result.value });
    setRuns((n) => n + 1);
    setTask('');
    setName('');
    setNameEdited(false);
  };

  const notice = preview
    ? 'Starting agents needs the server; the preview runs without one.'
    : (loadError ??
      (places === null
        ? null
        : !places.enabled
          ? 'Starting agents is off on this server (START_AGENTS=off).'
          : !places.reachable
            ? 'Orca is not reachable. Open the Orca app, then come back to this page.'
            : repos.length === 0
              ? 'Orca has no projects yet. Add one in Orca first.'
              : null));

  return (
    <Page
      trail={['New task']}
      title="New task"
      subtitle={`Say what you want done. ${provider === 'codex' ? 'Codex' : 'Claude Code'} starts on it in Orca and shows up in the office; you step in only when it needs you.`}
    >
      {notice !== null && (
        <p className={styles.notice} data-kind="problem">
          <WarningIcon size={16} />
          <span>{notice}</span>
        </p>
      )}
      {status.kind === 'started' && (
        <div className={styles.notice} data-kind="ok">
          <span>
            Started{status.where === '' ? '' : ` in ${status.where}`}. It shows up in the office in
            a moment.
          </span>
          <Button
            variant="link"
            onClick={() => {
              navigate('office');
            }}
          >
            Go to the office
          </Button>
        </div>
      )}

      <Wizard
        key={runs}
        steps={[
          {
            id: 'task',
            title: 'Task',
            hint: 'What should get done? Write it as you would for a teammate.',
            blocker: notice ?? (task.trim() === '' ? 'Write what should get done first.' : null),
            content: (
              <>
                <Tabs
                  options={PROVIDER_TABS}
                  value={provider}
                  onChange={setProvider}
                  label="Agent"
                />
                <Textarea
                  id={`${id}-task`}
                  aria-label="What should get done"
                  className={styles.task}
                  value={task}
                  rows={8}
                  onChange={(e) => {
                    setTask(e.target.value);
                    if (status.kind !== 'busy') setStatus({ kind: 'idle' });
                  }}
                  placeholder={
                    'Add a dark mode toggle to the settings page, with a test.\n\nOr: find why login fails on Safari and fix it.'
                  }
                  disabled={blocked}
                />
              </>
            ),
          },
          {
            id: 'where',
            title: 'Where',
            hint: 'A new worktree keeps this work apart from everything else you have going.',
            blocker:
              repo === null
                ? 'Pick a project.'
                : where === 'new'
                  ? nameValid
                    ? null
                    : 'Give the worktree a name: letters, digits, dots, dashes, underscores.'
                  : worktree === null
                    ? 'This project has no worktrees yet: make a new one.'
                    : null,
            content: (
              <>
                <Field id={`${id}-repo`} label="Project">
                  <Select
                    id={`${id}-repo`}
                    value={repo?.id ?? ''}
                    disabled={blocked}
                    placeholder="No projects in Orca"
                    onChange={(next) => {
                      setRepoId(next);
                      setWorktreeId(null);
                      rememberRepo(next);
                    }}
                    options={repos.map((r) => ({
                      value: r.id,
                      label: r.name,
                      detail: r.path,
                    }))}
                  />
                </Field>
                <Tabs
                  options={WHERE_TABS}
                  value={where}
                  onChange={setWhere}
                  label="Where it runs"
                />
                {where === 'new' ? (
                  <Field
                    id={`${id}-name`}
                    label="Worktree name"
                    hint="Orca makes a branch and a folder for it, so your other work stays as it is."
                    error={
                      nameValid || branchName === ''
                        ? undefined
                        : 'Letters, digits, dots, dashes and underscores.'
                    }
                  >
                    <Input
                      id={`${id}-name`}
                      value={branchName}
                      placeholder="Named after the task"
                      onChange={(e) => {
                        setName(e.target.value.replace(/\s+/g, '-'));
                        setNameEdited(true);
                      }}
                      spellCheck={false}
                      disabled={blocked}
                      invalid={branchName !== '' && !nameValid}
                    />
                  </Field>
                ) : (
                  <Field
                    id={`${id}-worktree`}
                    label="Worktree"
                    hint={
                      worktree === null ? undefined : (
                        <span className={styles.path}>
                          <FolderIcon size={12} /> {worktree.path}
                        </span>
                      )
                    }
                  >
                    <Select
                      id={`${id}-worktree`}
                      value={worktree?.id ?? ''}
                      disabled={blocked}
                      placeholder="No worktrees for this project"
                      onChange={setWorktreeId}
                      options={worktrees.map((w) => ({
                        value: w.id,
                        label: `${w.name}${w.main ? ' (main checkout)' : ''}`,
                        detail:
                          w.branch !== null && w.branch !== w.name
                            ? `${w.branch} · ${w.path}`
                            : w.path,
                      }))}
                    />
                  </Field>
                )}
              </>
            ),
          },
          {
            id: 'team',
            title: 'Team',
            optional: true,
            hint:
              provider === 'codex'
                ? 'Codex works on this task directly.'
                : members.length === 0
                  ? 'None picked: Claude hands work to your custom agents by itself when their description fits.'
                  : `The lead splits the work and hands parts to ${members.length === 1 ? 'this helper' : `these ${String(members.length)} helpers`}, then checks what comes back.`,
            content: (
              <>
                {provider === 'codex' ? (
                  <p className={styles.empty}>
                    Codex works directly. Saved custom agents are available with Claude Code.
                  </p>
                ) : available.length === 0 ? (
                  <p className={styles.empty}>
                    <CustomAgentsIcon size={16} />
                    No custom agents yet. Make a reviewer or a test runner in Custom agents, then
                    pick them here.
                  </p>
                ) : (
                  <ul className={styles.team}>
                    {available.map((a) => {
                      const on = team.includes(a.name);
                      const color = Object.entries(COLOR_HEX).find(([c]) => c === a.color)?.[1];
                      return (
                        <li key={`${a.scope}\n${a.file}`}>
                          <button
                            type="button"
                            className={styles.member}
                            aria-pressed={on}
                            onClick={() => {
                              setTeam((t) => (on ? t.filter((n) => n !== a.name) : [...t, a.name]));
                            }}
                            title={a.description}
                          >
                            <span
                              className={styles.dot}
                              style={{ background: color }}
                              aria-hidden
                            />
                            <span className={styles.memberText}>
                              <span className={styles.memberName}>{a.name}</span>
                              <span className={styles.memberAbout}>{a.description}</span>
                            </span>
                            <span className={styles.check} aria-hidden />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {provider === 'claude' && (
                  <Button
                    variant="link"
                    className={styles.manage}
                    onClick={() => {
                      navigate('custom-agents');
                    }}
                  >
                    Manage custom agents
                  </Button>
                )}
              </>
            ),
          },
          {
            id: 'review',
            title: 'Review',
            hint: `Check it, then start: ${provider === 'codex' ? 'Codex' : 'Claude Code'} opens in Orca with this as its first prompt.`,
            content: (
              <>
                <dl className={styles.summary}>
                  <div>
                    <dt>Agent</dt>
                    <dd>{provider === 'codex' ? 'Codex' : 'Claude Code'}</dd>
                  </div>
                  <div>
                    <dt>Runs in</dt>
                    <dd>
                      {where === 'new'
                        ? `${repo?.name ?? '…'} → new worktree ${branchName || '…'}`
                        : (worktree?.path ?? '…')}
                    </dd>
                  </div>
                  <div>
                    <dt>Team</dt>
                    <dd>
                      {provider === 'codex'
                        ? 'Codex works directly'
                        : members.length === 0
                          ? 'Claude picks helpers itself'
                          : members.map((m) => m.name).join(', ')}
                    </dd>
                  </div>
                </dl>
                <Field label="What the lead agent gets">
                  <pre className={styles.prompt}>{prompt || '…'}</pre>
                </Field>
              </>
            ),
          },
        ]}
        finishLabel="Start"
        finishIcon={<SendIcon size={16} />}
        onFinish={() => {
          void handleStart();
        }}
        busy={status.kind === 'busy'}
        status={
          status.kind === 'error'
            ? status.message
            : status.kind === 'busy'
              ? where === 'new'
                ? `Making the worktree and starting ${provider === 'codex' ? 'Codex' : 'Claude Code'}…`
                : `Starting ${provider === 'codex' ? 'Codex' : 'Claude Code'}…`
              : undefined
        }
      />
    </Page>
  );
}
