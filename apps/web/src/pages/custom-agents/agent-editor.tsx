import { CUSTOM_AGENT_COLORS } from '@agent-office/shared';
import type { CustomAgent, CustomAgentScope } from '@agent-office/shared';
import { useEffect, useId, useState } from 'react';
import { deleteCustomAgent, saveCustomAgent } from '../../api/custom-agents/custom-agents.services';
import { TrashIcon, WarningIcon } from '../../components/icons';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Textarea } from '../../components/ui/textarea';
import { Wizard } from '../../components/ui/wizard';
import type { Draft, DraftField } from './schema';
import { COMMON_TOOLS, MODELS, NEW_DRAFT, draftOf, inputOf, sameDraft } from './schema';
import { COLOR_HEX } from '../../lib/agent-colors';
import styles from './page.module.css';

interface AgentEditorProps {
  /** The agent being edited; null to create one. */
  readonly agent: CustomAgent | null;
  /** Where a new agent can go. */
  readonly scopes: readonly CustomAgentScope[];
  readonly editable: boolean;
  readonly onSaved: (agent: CustomAgent) => void;
  readonly onDeleted: (trashedTo: string) => void;
  /** Tells the page whether there are unsaved changes. */
  readonly onDirtyChange: (dirty: boolean) => void;
  /** Just saved: open with that said. */
  readonly justSaved?: boolean;
}

type Status =
  | { readonly kind: 'idle' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'saved' };

/** The form for one agent file: its frontmatter fields and its system prompt. */
export function AgentEditor({
  agent,
  scopes,
  editable,
  onSaved,
  onDeleted,
  onDirtyChange,
  justSaved = false,
}: AgentEditorProps): React.JSX.Element {
  const initial = agent === null ? NEW_DRAFT : draftOf(agent);
  const [draft, setDraft] = useState<Draft>(initial);
  const [scopeId, setScopeId] = useState(agent?.scope ?? scopes[0]?.id ?? 'user');
  const [errors, setErrors] = useState<Partial<Record<DraftField, string>>>({});
  const [status, setStatus] = useState<Status>({ kind: justSaved ? 'saved' : 'idle' });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const id = useId();

  const isNew = agent === null;
  const problem = agent?.problem ?? null;
  const note = agent?.note ?? null;
  const locked = !editable || problem !== null;
  const dirty = !sameDraft(draft, initial);
  const busy = status.kind === 'busy';

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  /** A patch, or a function of the latest draft (for toggles clicked in quick succession). */
  const change = (patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => {
    const keys = Object.keys(typeof patch === 'function' ? patch(draft) : patch);
    setDraft((d) => ({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) }));
    setStatus({ kind: 'idle' });
    // Editing a field clears its complaint (both tools inputs share one).
    const touched = new Set(
      keys.map((key) => (key === 'otherTools' || key === 'allTools' ? 'tools' : key)),
    );
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([key]) => !touched.has(key))));
  };

  const save = async () => {
    // Enter in a field submits too; nothing changed, nothing to write.
    if (!dirty || busy) return;
    const result = inputOf(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setStatus({ kind: 'busy' });
    const saved = await saveCustomAgent(
      agent === null
        ? { scope: scopeId, agent: result.input }
        : {
            scope: agent.scope,
            file: agent.file,
            modifiedAt: agent.modifiedAt,
            agent: result.input,
          },
    );
    if (!saved.ok) {
      setStatus({ kind: 'error', message: saved.error });
      return;
    }
    onSaved(saved.value);
  };

  const remove = async () => {
    if (agent === null) return;
    setStatus({ kind: 'busy' });
    const removed = await deleteCustomAgent({ scope: agent.scope, file: agent.file });
    if (!removed.ok) {
      setStatus({ kind: 'error', message: removed.error });
      setConfirmDelete(false);
      return;
    }
    onDeleted(removed.value);
  };

  const scope = scopes.find((s) => s.id === scopeId);
  const where =
    agent?.path ??
    (scope === undefined ? '' : `${scope.dir}/${draft.name === '' ? '<name>' : draft.name}.md`);
  const modelChoices =
    draft.model === '' || MODELS.some((m) => m.value === draft.model)
      ? MODELS
      : [...MODELS, { value: draft.model, label: draft.model }];

  // What each step still needs, from the same checks the save uses.
  const check = inputOf(draft);
  const problems = check.ok ? {} : check.errors;
  const tools = draft.allTools
    ? 'All tools'
    : [...draft.tools, ...draft.otherTools.split(',').map((t) => t.trim())]
        .filter(Boolean)
        .join(', ') || 'None yet';
  const fieldsDisabled = locked || busy;

  return (
    <div className={styles.editor} aria-label={isNew ? 'New agent' : `Edit ${agent.name}`}>
      <Wizard
        header={
          <>
            <div className={styles.editorHead}>
              <span
                className={styles.dot}
                style={{ background: draft.color === null ? undefined : COLOR_HEX[draft.color] }}
                aria-hidden
              />
              <div className={styles.editorTitle}>
                <h2>{isNew ? draft.name || 'New agent' : agent.name}</h2>
                <code className={styles.path} title={where}>
                  {where}
                </code>
              </div>
            </div>

            {note !== null && (
              <p className={styles.notice} data-kind="note">
                <WarningIcon size={16} />
                <span>
                  {note}
                  <br />
                  <strong>Saving here works, but that tool may replace your edit later.</strong>
                </span>
              </p>
            )}
            {problem !== null && (
              <p className={styles.notice} data-kind="problem">
                <WarningIcon size={16} />
                <span>{problem}. Fix the file in your editor; it is shown here read-only.</span>
              </p>
            )}
            {!editable && (
              <p className={styles.notice} data-kind="note">
                <WarningIcon size={16} />
                <span>Editing is off on this server (CUSTOM_AGENTS=off).</span>
              </p>
            )}
          </>
        }
        free={!isNew}
        finishLabel={isNew ? 'Create agent' : 'Save'}
        onFinish={
          locked
            ? undefined
            : () => {
                void save();
              }
        }
        finishDisabled={!dirty}
        busy={busy}
        onBlocked={() => {
          setErrors(problems);
        }}
        steps={[
          {
            id: 'basics',
            title: 'Basics',
            hint: 'Its name, and when Claude should hand it work.',
            blocker: problems.name ?? problems.description ?? null,
            content: (
              <fieldset className={styles.fields} disabled={fieldsDisabled}>
                <Field
                  id={`${id}-name`}
                  label="Name"
                  hint="Lowercase letters, digits and hyphens"
                  error={errors.name}
                >
                  <Input
                    id={`${id}-name`}
                    invalid={errors.name !== undefined}
                    value={draft.name}
                    onChange={(e) => {
                      change({ name: e.target.value.toLowerCase().replace(/\s+/g, '-') });
                    }}
                    placeholder="code-reviewer"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>
                {isNew && scopes.length > 1 && (
                  <Field id={`${id}-scope`} label="Save in" hint="Yours work in every project">
                    <Select
                      id={`${id}-scope`}
                      value={scopeId}
                      onChange={setScopeId}
                      options={scopes.map((s) => ({
                        value: s.id,
                        label: s.kind === 'user' ? 'Yours (every project)' : `Project: ${s.label}`,
                        detail: s.dir,
                      }))}
                    />
                  </Field>
                )}
                <Field
                  id={`${id}-description`}
                  label="Description"
                  hint="When Claude should hand work to this agent; Claude reads it to decide"
                  error={errors.description}
                >
                  <Textarea
                    id={`${id}-description`}
                    rows={3}
                    invalid={errors.description !== undefined}
                    value={draft.description}
                    onChange={(e) => {
                      change({ description: e.target.value });
                    }}
                    placeholder="Reviews code for bugs and style right after you change it. Use proactively."
                  />
                </Field>
              </fieldset>
            ),
          },
          {
            id: 'look',
            title: 'Model & color',
            hint: 'Which model it thinks with, and how Claude Code shows it at work.',
            blocker: problems.model ?? null,
            content: (
              <fieldset className={styles.fields} disabled={fieldsDisabled}>
                <div className={styles.pair}>
                  <Field id={`${id}-model`} label="Model" error={errors.model}>
                    <Select
                      id={`${id}-model`}
                      value={draft.model}
                      onChange={(model) => {
                        change({ model });
                      }}
                      options={modelChoices}
                    />
                  </Field>
                  <Field id={`${id}-color`} label="Color">
                    <div
                      className={styles.swatches}
                      role="radiogroup"
                      id={`${id}-color`}
                      aria-label="Color"
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={draft.color === null}
                        className={styles.swatch}
                        data-none
                        title="No color"
                        onClick={() => {
                          change({ color: null });
                        }}
                      />
                      {CUSTOM_AGENT_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          role="radio"
                          aria-checked={draft.color === c}
                          className={styles.swatch}
                          style={{ background: COLOR_HEX[c] }}
                          title={c}
                          onClick={() => {
                            change({ color: c });
                          }}
                        />
                      ))}
                    </div>
                  </Field>
                </div>
              </fieldset>
            ),
          },
          {
            id: 'tools',
            title: 'Tools',
            hint: 'What it may use. Fewer tools keep a helper focused.',
            blocker: problems.tools ?? null,
            content: (
              <fieldset className={styles.fields} disabled={fieldsDisabled}>
                <Field id={`${id}-tools`} label="Tools" error={errors.tools}>
                  <label className={styles.allTools} htmlFor={`${id}-tools`}>
                    <span>
                      <strong>All tools</strong>
                      <span>Everything the main conversation can use, MCP tools too</span>
                    </span>
                    <Switch
                      id={`${id}-tools`}
                      checked={draft.allTools}
                      disabled={fieldsDisabled}
                      onChange={(allTools) => {
                        change({ allTools });
                      }}
                    />
                  </label>
                  {!draft.allTools && (
                    <>
                      <div className={styles.chips}>
                        {COMMON_TOOLS.map((tool) => {
                          const on = draft.tools.includes(tool);
                          return (
                            <button
                              key={tool}
                              type="button"
                              className={styles.chip}
                              aria-pressed={on}
                              onClick={() => {
                                change((d) => ({
                                  tools: d.tools.includes(tool)
                                    ? d.tools.filter((t) => t !== tool)
                                    : [...d.tools, tool],
                                }));
                              }}
                            >
                              {tool}
                            </button>
                          );
                        })}
                      </div>
                      <Input
                        value={draft.otherTools}
                        onChange={(e) => {
                          change({ otherTools: e.target.value });
                        }}
                        placeholder="Other tools, comma-separated: mcp__github__get_issue, Bash(git diff:*)"
                        aria-label="Other tools"
                        spellCheck={false}
                      />
                    </>
                  )}
                </Field>
              </fieldset>
            ),
          },
          {
            id: 'prompt',
            title: 'Prompt',
            hint: 'Who the agent is and how it works. It sees this, not your conversation.',
            blocker: problems.prompt ?? null,
            content: (
              <fieldset className={styles.fields} disabled={fieldsDisabled}>
                <Field id={`${id}-prompt`} label="System prompt" error={errors.prompt}>
                  <Textarea
                    id={`${id}-prompt`}
                    mono
                    className={styles.prompt}
                    rows={16}
                    value={draft.prompt}
                    onChange={(e) => {
                      change({ prompt: e.target.value });
                    }}
                    placeholder={
                      'You are a senior code reviewer.\n\nWhen invoked:\n1. Run git diff …'
                    }
                    spellCheck={false}
                  />
                </Field>
              </fieldset>
            ),
          },
          ...(isNew
            ? [
                {
                  id: 'review',
                  title: 'Review',
                  hint: 'Check it, then create the file. New Claude Code sessions pick it up.',
                  content: (
                    <dl className={styles.summary}>
                      <div>
                        <dt>Name</dt>
                        <dd>{draft.name || '…'}</dd>
                      </div>
                      <div>
                        <dt>File</dt>
                        <dd>
                          <code>{where}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>Description</dt>
                        <dd>{draft.description || '…'}</dd>
                      </div>
                      <div>
                        <dt>Model</dt>
                        <dd>
                          {modelChoices.find((m) => m.value === draft.model)?.label ?? draft.model}
                        </dd>
                      </div>
                      <div>
                        <dt>Tools</dt>
                        <dd>{tools}</dd>
                      </div>
                      <div>
                        <dt>Prompt</dt>
                        <dd className={styles.summaryPrompt}>{draft.prompt || 'Empty'}</dd>
                      </div>
                    </dl>
                  ),
                },
              ]
            : []),
        ]}
        secondary={
          <>
            {!isNew &&
              editable &&
              problem === null &&
              (confirmDelete ? (
                <span className={styles.confirm}>
                  Move to the trash?
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() => {
                      void remove();
                    }}
                  >
                    Move to trash
                  </Button>
                  <Button
                    onClick={() => {
                      setConfirmDelete(false);
                    }}
                  >
                    Keep
                  </Button>
                </span>
              ) : (
                <Button
                  variant="danger-ghost"
                  icon={<TrashIcon size={15} />}
                  disabled={busy}
                  onClick={() => {
                    setConfirmDelete(true);
                  }}
                >
                  Delete
                </Button>
              ))}
            {!locked && dirty && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setDraft(initial);
                  setErrors({});
                  setStatus({ kind: 'idle' });
                }}
              >
                {isNew ? 'Clear' : 'Revert'}
              </Button>
            )}
          </>
        }
        status={
          status.kind === 'error'
            ? status.message
            : status.kind === 'saved'
              ? 'Saved. New sessions use it.'
              : status.kind === 'busy'
                ? 'Saving…'
                : dirty
                  ? 'Unsaved changes'
                  : undefined
        }
      />
    </div>
  );
}
