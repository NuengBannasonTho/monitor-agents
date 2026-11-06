import { worktreeNameFor, WORKTREE_NAME_PATTERN } from '@agent-office/shared';
import type { AssistantChatResponse, TaskPlaces } from '@agent-office/shared';
import { useEffect, useRef, useState } from 'react';
import { APP_NAME } from '../../lib/brand';
import { askAssistant } from '../../live/assistant';
import { fetchTaskPlaces, startTask } from '../../live/tasks';
import { navigate } from '../../lib/route';
import { FolderIcon, SendIcon } from '../icons';
import { Button } from '../ui/Button';
import { Page } from '../ui/Page';
import styles from './AssistantPage.module.css';

interface Message {
  readonly id: number;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly response?: AssistantChatResponse;
}

const STORAGE_KEY = 'agent-office:assistant-chat:v1';
const INTRO: Message = {
  id: 0,
  role: 'assistant',
  content:
    'สวัสดีครับ บอกได้เลยว่าต้องการหาโปรเจกต์ไหน หรืออยากให้ทำงานอะไร ผมจะช่วยเลือกโปรเจกต์และเตรียมงานให้ตรวจ',
};

function savedMessages(): Message[] {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!Array.isArray(value)) return [INTRO];
    const entries: unknown[] = value;
    const messages = entries
      .filter(
        (item): item is Message =>
          typeof item === 'object' &&
          item !== null &&
          'role' in item &&
          'content' in item &&
          'id' in item &&
          (item.role === 'user' || item.role === 'assistant') &&
          typeof item.content === 'string' &&
          typeof item.id === 'number',
      )
      .slice(-30);
    return messages.length > 0 ? [INTRO, ...messages.filter((item) => item.id !== 0)] : [INTRO];
  } catch {
    return [INTRO];
  }
}

function TaskDraft({
  response,
  places,
}: {
  readonly response: AssistantChatResponse;
  readonly places: TaskPlaces | null;
}) {
  const draft = response.draft;
  const [repoId, setRepoId] = useState(draft?.repoId ?? response.matches[0]?.id ?? '');
  const [provider, setProvider] = useState<'claude' | 'codex'>(draft?.provider ?? 'codex');
  const [where, setWhere] = useState<'new' | 'existing'>('new');
  const [worktreeId, setWorktreeId] = useState('');
  const [task, setTask] = useState(draft?.task ?? '');
  const [branch, setBranch] = useState(
    () =>
      `${worktreeNameFor(draft?.task ?? 'task').slice(0, 48)}-${Date.now().toString(36).slice(-5)}`,
  );
  const [status, setStatus] = useState<'idle' | 'busy' | 'started'>('idle');
  const [error, setError] = useState<string | null>(null);
  if (draft === null) return null;
  const repos = places?.repos ?? response.matches;
  const worktrees = (places?.worktrees ?? []).filter((item) => item.repoId === repoId);
  const worktree = worktrees.find((item) => item.id === worktreeId) ?? worktrees[0] ?? null;
  const canStart =
    places?.enabled === true &&
    places.reachable &&
    repos.some((repo) => repo.id === repoId) &&
    task.trim() !== '' &&
    (where === 'new' ? WORKTREE_NAME_PATTERN.test(branch) : worktree !== null) &&
    status === 'idle';
  const start = async () => {
    if (!canStart) return;
    setStatus('busy');
    setError(null);
    const result = await startTask({
      provider,
      task,
      where:
        where === 'new'
          ? { kind: 'new', repoId, name: branch }
          : { kind: 'existing', worktreeId: worktree?.id ?? '' },
      team: [],
    });
    if (result.ok) setStatus('started');
    else {
      setStatus('idle');
      setError(result.error);
    }
  };
  return (
    <div className={styles.draft}>
      <strong>Ready to assign</strong>
      <label>
        Project
        <select
          value={repoId}
          onChange={(event) => {
            setRepoId(event.target.value);
            setWorktreeId('');
          }}
        >
          <option value="">Choose a project</option>
          {repos.map((repo) => (
            <option key={repo.id} value={repo.id}>
              {repo.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Run in
        <select
          value={where}
          onChange={(event) => {
            setWhere(event.target.value as 'new' | 'existing');
          }}
        >
          <option value="new">New worktree</option>
          <option value="existing">Existing worktree</option>
        </select>
      </label>
      {where === 'existing' && (
        <label>
          Worktree
          <select
            value={worktree?.id ?? ''}
            onChange={(event) => {
              setWorktreeId(event.target.value);
            }}
          >
            {worktrees.length === 0 && <option value="">No worktrees in this project</option>}
            {worktrees.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Agent
        <select
          value={provider}
          onChange={(event) => {
            setProvider(event.target.value as 'claude' | 'codex');
          }}
        >
          <option value="codex">Codex</option>
          <option value="claude">Claude Code</option>
        </select>
      </label>
      <label>
        Task
        <textarea
          value={task}
          rows={4}
          onChange={(event) => {
            setTask(event.target.value);
          }}
        />
      </label>
      {where === 'new' && (
        <label>
          New worktree name
          <input
            value={branch}
            onChange={(event) => {
              setBranch(event.target.value);
            }}
          />
        </label>
      )}
      {error !== null && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {status === 'started' ? (
        <p className={styles.success}>
          Started in Orca.{' '}
          <button
            type="button"
            onClick={() => {
              navigate('office');
            }}
          >
            View office
          </button>
        </p>
      ) : (
        <Button
          variant="primary"
          size="sm"
          disabled={!canStart}
          onClick={() => {
            void start();
          }}
        >
          {status === 'busy' ? 'Starting…' : 'Start task'}
        </Button>
      )}
    </div>
  );
}

export function AssistantPage({ preview }: { readonly preview: boolean }) {
  const [messages, setMessages] = useState<Message[]>(savedMessages);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [places, setPlaces] = useState<TaskPlaces | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(messages.filter((message) => message.id !== 0).slice(-30)),
      );
    } catch {
      /* Private browsing can block storage. */
    }
    const list = listRef.current;
    if (list !== null) list.scrollTop = list.scrollHeight;
  }, [messages]);
  useEffect(() => {
    if (preview) return;
    let live = true;
    void fetchTaskPlaces().then((result) => {
      if (live && result.ok) setPlaces(result.value);
    });
    return () => {
      live = false;
    };
  }, [preview]);

  const send = async () => {
    const message = input.trim();
    if (message === '' || busy || preview) return;
    const history = messages
      .filter((item) => item.id !== 0)
      .slice(-12)
      .map((item) => ({ role: item.role, content: item.content }));
    setMessages((items) => [...items, { id: Date.now(), role: 'user', content: message }]);
    setInput('');
    setBusy(true);
    const result = await askAssistant({ message, history });
    setMessages((items) => [
      ...items,
      {
        id: Date.now() + 1,
        role: 'assistant',
        content: result.ok ? result.value.reply : result.error,
        ...(result.ok ? { response: result.value } : {}),
      },
    ]);
    setBusy(false);
  };

  return (
    <Page
      trail={['Assistant']}
      title="Your assistant"
      subtitle="Find a project, plan work, and start a Codex or Claude agent from one conversation."
      fill
      actions={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setMessages([INTRO]);
          }}
        >
          Clear chat
        </Button>
      }
    >
      <div className={styles.shell}>
        <div className={styles.messages} ref={listRef} aria-live="polite">
          {messages.map((message) => (
            <div key={message.id} className={styles.message} data-role={message.role}>
              <span className={styles.speaker}>
                {message.role === 'assistant' ? APP_NAME : 'You'}
              </span>
              <p>{message.content}</p>
              {message.response?.matches && message.response.matches.length > 0 && (
                <ul className={styles.matches}>
                  {message.response.matches.map((repo) => (
                    <li key={repo.id}>
                      <FolderIcon size={14} />
                      <span>
                        <strong>{repo.name}</strong>
                        <small>{repo.path}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {message.response?.draft && <TaskDraft response={message.response} places={places} />}
            </div>
          ))}
          {busy && (
            <div className={styles.thinking} role="status">
              Assistant is thinking…
            </div>
          )}
        </div>
        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <textarea
            aria-label="Message your assistant"
            value={input}
            rows={3}
            placeholder="เช่น หาโปรเจกต์ frontend ให้หน่อย หรือ ให้ Codex แก้หน้า login ใน ai-hub-frontend"
            onChange={(event) => {
              setInput(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send();
              }
            }}
            disabled={busy || preview}
          />
          <Button
            type="submit"
            variant="primary"
            icon={<SendIcon size={16} />}
            disabled={busy || input.trim() === '' || preview}
          >
            Send
          </Button>
        </form>
        {preview && <p className={styles.preview}>The assistant needs the local server.</p>}
      </div>
    </Page>
  );
}
