import type { CustomAgent, CustomAgentList, CustomAgentScope } from '@agent-office/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Result } from '../../live/customAgents';
import { fetchCustomAgents } from '../../live/customAgents';
import { BackIcon, CustomAgentsIcon, PlusIcon, ReloadIcon, WarningIcon } from '../icons';
import { Button } from '../ui/Button';
import { Page } from '../ui/Page';
import { AgentEditor } from './AgentEditor';
import { COLOR_HEX } from './colors';
import styles from './CustomAgentsPage.module.css';

type Selection =
  | { readonly kind: 'agent'; readonly scope: string; readonly file: string }
  | { readonly kind: 'new' }
  | null;

const keyOf = (a: Pick<CustomAgent, 'scope' | 'file'>): string => `${a.scope}\n${a.file}`;

/** "~/…" for paths under your home, found from where your own agents live. */
function homeShortener(scopes: readonly CustomAgentScope[]): (dir: string) => string {
  const user = scopes.find((s) => s.kind === 'user')?.dir ?? '';
  const suffix = '/.claude/agents';
  const home = user.endsWith(suffix) ? user.slice(0, -suffix.length) : null;
  return (dir) =>
    home !== null && dir.startsWith(`${home}/`) ? `~${dir.slice(home.length)}` : dir;
}

/**
 * Claude Code subagents: yours (~/.claude/agents) and those of each project an agent is
 * working in. Pick one to edit its file, or create one.
 */
export function CustomAgentsPage({ preview }: { readonly preview: boolean }) {
  const [list, setList] = useState<CustomAgentList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const [trashedTo, setTrashedTo] = useState<string | null>(null);
  const dirty = useRef(false);

  const apply = useCallback((result: Result<CustomAgentList>) => {
    if (result.ok) {
      setList(result.value);
      setError(null);
    } else {
      setError(result.error);
    }
  }, []);
  const refresh = useCallback(() => {
    void fetchCustomAgents().then(apply);
  }, [apply]);

  useEffect(() => {
    if (preview) return;
    let live = true;
    const load = () => {
      void fetchCustomAgents().then((result) => {
        if (live) apply(result);
      });
    };
    load();
    // Back from an editor elsewhere: show what changed on disk, unless you are mid-edit.
    const onFocus = () => {
      if (!dirty.current) load();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      live = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [preview, apply]);

  const onDirtyChange = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);

  const select = (next: Selection) => {
    if (dirty.current && !window.confirm('Discard your unsaved changes?')) return;
    dirty.current = false;
    setSelection(next);
    setJustSaved(null);
    setTrashedTo(null);
  };

  const onSaved = (agent: CustomAgent) => {
    dirty.current = false;
    // Show it right away; the reload after confirms it from disk.
    setList((current) =>
      current === null
        ? current
        : {
            ...current,
            agents: [...current.agents.filter((a) => keyOf(a) !== keyOf(agent)), agent].sort(
              (a, b) => a.file.localeCompare(b.file),
            ),
          },
    );
    setSelection({ kind: 'agent', scope: agent.scope, file: agent.file });
    setJustSaved(keyOf(agent));
    refresh();
  };

  const onDeleted = (where: string) => {
    const gone = selection;
    dirty.current = false;
    setList((current) =>
      current === null || gone?.kind !== 'agent'
        ? current
        : { ...current, agents: current.agents.filter((a) => keyOf(a) !== keyOf(gone)) },
    );
    setSelection(null);
    setTrashedTo(where);
    refresh();
  };

  const scopes = list?.scopes ?? [];
  const agents = list?.agents ?? [];
  const short = homeShortener(scopes);
  const selected =
    selection?.kind === 'agent'
      ? (agents.find((a) => a.scope === selection.scope && a.file === selection.file) ?? null)
      : null;
  const editable = list?.editable ?? false;

  return (
    <Page
      trail={['Custom agents']}
      title="Custom agents"
      subtitle="Claude Code subagents. Claude hands a task to one when it fits its description, or when you ask for it by name."
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={<ReloadIcon size={16} />}
            onClick={() => {
              if (!dirty.current || window.confirm('Reload and discard your unsaved changes?')) {
                dirty.current = false;
                refresh();
              }
            }}
            disabled={preview}
            title="Reload from disk"
            aria-label="Reload from disk"
          />
          <Button
            variant="primary"
            size="sm"
            icon={<PlusIcon size={16} />}
            disabled={!editable}
            onClick={() => {
              select({ kind: 'new' });
            }}
          >
            New agent
          </Button>
        </>
      }
    >
      {(preview || error !== null) && (
        <p className={styles.notice} data-kind="problem">
          <WarningIcon size={16} />
          <span>
            {preview ? 'Custom agents need the server; the preview runs without one.' : error}
          </span>
        </p>
      )}
      {trashedTo !== null && (
        <p className={styles.notice} data-kind="ok">
          <TrashNote where={short(trashedTo)} />
        </p>
      )}

      <div className={styles.layout} data-editing={selection !== null}>
        <div className={styles.list}>
          {list === null && !preview && error === null && <p className={styles.muted}>Loading…</p>}
          {scopes.map((scope) => {
            const inScope = agents.filter((a) => a.scope === scope.id);
            return (
              <section key={scope.id} className={styles.scope}>
                <h2 className={styles.scopeTitle}>
                  {scope.kind === 'user' ? 'Yours' : scope.label}
                  <span className={styles.scopeKind}>
                    {scope.kind === 'user' ? 'every project' : 'this project'}
                  </span>
                </h2>
                <code className={styles.scopeDir} title={scope.dir}>
                  {short(scope.dir)}
                </code>
                {inScope.length === 0 ? (
                  <p className={styles.muted}>No agents here yet</p>
                ) : (
                  <ul className={styles.items}>
                    {inScope.map((agent) => (
                      <li key={agent.file}>
                        <AgentItem
                          agent={agent}
                          active={selected !== null && keyOf(selected) === keyOf(agent)}
                          onSelect={() => {
                            select({ kind: 'agent', scope: agent.scope, file: agent.file });
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        <div className={styles.pane}>
          {selection !== null && (
            <Button
              size="sm"
              className={styles.back}
              icon={<BackIcon size={15} />}
              onClick={() => {
                select(null);
              }}
            >
              All agents
            </Button>
          )}
          {selection === null ? (
            <div className={styles.placeholder}>
              <CustomAgentsIcon size={28} />
              <h2>Pick an agent, or make one</h2>
              <p>
                Each is a Markdown file: a name and a description on top, then the prompt it works
                from. Claude Code reads them when a session starts, so new sessions pick up your
                changes.
              </p>
            </div>
          ) : selection.kind === 'new' ? (
            <AgentEditor
              key="new"
              agent={null}
              scopes={scopes}
              editable={editable}
              onSaved={onSaved}
              onDeleted={onDeleted}
              onDirtyChange={onDirtyChange}
            />
          ) : selected === null ? (
            <p className={styles.muted}>That agent file is gone.</p>
          ) : (
            <AgentEditor
              key={`${keyOf(selected)}\n${String(selected.modifiedAt)}`}
              agent={selected}
              scopes={scopes}
              editable={editable}
              justSaved={justSaved === keyOf(selected)}
              onSaved={onSaved}
              onDeleted={onDeleted}
              onDirtyChange={onDirtyChange}
            />
          )}
        </div>
      </div>
    </Page>
  );
}

function TrashNote({ where }: { where: string }) {
  return (
    <span>
      Moved to the trash, not deleted: <code>{where}</code>
    </span>
  );
}

function AgentItem({
  agent,
  active,
  onSelect,
}: {
  agent: CustomAgent;
  active: boolean;
  onSelect: () => void;
}) {
  const color = Object.entries(COLOR_HEX).find(([name]) => name === agent.color)?.[1];
  return (
    <button
      type="button"
      className={styles.item}
      aria-current={active ? 'true' : undefined}
      onClick={onSelect}
      title={agent.path}
    >
      <span className={styles.dot} style={{ background: color }} aria-hidden />
      <span className={styles.itemText}>
        <span className={styles.itemName}>{agent.name}</span>
        <span className={styles.itemDescription}>{agent.description || 'No description'}</span>
        <span className={styles.itemTags}>
          <span>{agent.model ?? 'Default model'}</span>
          <span>
            {agent.tools === null
              ? 'All tools'
              : `${String(agent.tools.length)} tool${agent.tools.length === 1 ? '' : 's'}`}
          </span>
          {agent.note !== null && <span data-kind="note">Managed</span>}
          {agent.problem !== null && <span data-kind="problem">Needs a fix</span>}
        </span>
      </span>
    </button>
  );
}
