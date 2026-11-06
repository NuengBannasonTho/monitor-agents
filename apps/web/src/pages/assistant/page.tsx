import { AssistantChatResponseSchema, runsAtOnce, zoneOf } from '@agent-office/shared';
import type { Agent, AssistantChatResponse, TaskPlaces } from '@agent-office/shared';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getPersona, usePersona } from '../../lib/persona';
import { navigate } from '../../lib/route';
import { askAssistant } from '../../api/assistant/assistant.services';
import { fetchTaskPlaces } from '../../api/tasks/tasks.services';
import { COLOR_HEX } from '../../lib/agent-colors';
import { AppearanceIcon, CampIcon, FolderIcon, NeedsYouIcon, WorkIcon } from '../../components/icons';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Page } from '../../components/ui/page';
import type { MessageBoxHandle } from '../../components/ui/message-box';
import { MessageBox } from '../../components/ui/message-box';
import type { ActionDeps, Outcome } from '../../components/assistant/actions';
import { actionLog, runAction } from '../../components/assistant/actions';
import { ActionCard } from '../../components/assistant/action-card';
import { MonAvatar } from '../../components/assistant/mon-avatar';
import { STYLE_META, greeting, personaSummary } from '../../components/assistant/persona-text';
import styles from './page.module.css';

interface Message {
  readonly id: number;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly response?: AssistantChatResponse;
  /** What became of each proposed action, by its index. */
  readonly outcomes?: Readonly<Record<number, Outcome>>;
  /** The answer did not come: shown, but not sent back as conversation. */
  readonly failed?: boolean;
}

const STORAGE_KEY = 'agent-office:assistant-chat:v2';

let lastId = 0;
/** A message id: the time, kept increasing. */
function newId(): number {
  lastId = Math.max(lastId + 1, Date.now());
  return lastId;
}
const KEEP = 40;

const isOutcome = (value: unknown): value is Outcome =>
  typeof value === 'object' &&
  value !== null &&
  'ok' in value &&
  'note' in value &&
  typeof value.ok === 'boolean' &&
  typeof value.note === 'string';

/** This tab's conversation: anything that no longer reads is dropped. */
function savedMessages(): Message[] {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!Array.isArray(value)) return [];
    const items: unknown[] = value;
    return items.slice(-KEEP).flatMap((item): Message[] => {
      if (typeof item !== 'object' || item === null) return [];
      const m = item as Record<string, unknown>;
      if (
        typeof m.id !== 'number' ||
        (m.role !== 'user' && m.role !== 'assistant') ||
        typeof m.content !== 'string'
      )
        return [];
      const response = AssistantChatResponseSchema.safeParse(m.response);
      const outcomes =
        typeof m.outcomes === 'object' && m.outcomes !== null
          ? Object.fromEntries(
              Object.entries(m.outcomes).filter(
                (entry): entry is [string, Outcome] => isOutcome(entry[1]),
              ),
            )
          : undefined;
      return [
        {
          id: m.id,
          role: m.role,
          content: m.content,
          ...(response.success ? { response: response.data } : {}),
          ...(outcomes === undefined ? {} : { outcomes }),
          ...(m.failed === true ? { failed: true } : {}),
        },
      ];
    });
  } catch {
    return [];
  }
}

/** The conversation as MON MANG reads it back, with what became of its actions. */
function historyOf(messages: readonly Message[]): { role: 'user' | 'assistant'; content: string }[] {
  return messages
    .filter((m) => m.failed !== true)
    .slice(-12)
    .map((m) => {
      const actions = m.response?.actions ?? [];
      const content =
        actions.length === 0
          ? m.content
          : `${m.content}\n[actions] ${actionLog(actions, m.outcomes)}`;
      return { role: m.role, content: content.slice(0, 4_000) };
    });
}

interface Suggestion {
  readonly text: string;
  /** Sent at once; otherwise put in the box to finish. */
  readonly send: boolean;
}

const SUGGESTIONS: readonly Suggestion[] = [
  { text: 'ใครรอฉันอยู่บ้าง ช่วยสรุปให้หน่อย', send: true },
  { text: 'ตอนนี้แต่ละ agent ทำอะไรอยู่', send: true },
  { text: 'วันนี้ใช้ไปเท่าไหร่แล้ว', send: true },
  { text: 'ให้ Codex ', send: false },
  { text: 'สร้าง custom agent ไว้รีวิวโค้ดก่อน merge', send: false },
  { text: 'เปลี่ยนเป็นธีมมืด แล้วเปิดเสียงแจ้งเตือน', send: true },
];

const CAN_DO = [
  'Start Claude Code or Codex on a task, in a new or existing worktree',
  'Answer or steer an agent that needs you, or stop it',
  'Sum up who is working, waiting or done, and what today cost',
  'Make custom agents, change the theme, sound and desktop bananas',
  'Change its own personality when you ask',
];

export interface AssistantPageProps {
  readonly preview: boolean;
  readonly agents: readonly Agent[];
  /** Opens an agent's drawer. */
  readonly onOpen: (id: string) => void;
  readonly sound: { readonly setEnabled: (on: boolean) => void };
  readonly alerts: { readonly setEnabled: (on: boolean) => void };
}

/**
 * MON MANG, the heart of the dashboard: you say what you want, it answers in the personality
 * you gave it and lines up the actions; harmless ones happen at once, the rest wait for your
 * click. Beside the chat: who needs you now and what to ask.
 */
export function AssistantPage({ preview, agents, onOpen, sound, alerts }: AssistantPageProps) {
  const persona = usePersona();
  const [messages, setMessages] = useState<Message[]>(savedMessages);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [places, setPlaces] = useState<TaskPlaces | null>(null);
  const [stopped, setStopped] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<MessageBoxHandle>(null);
  /** The answer being waited for, so the stop button can drop it. */
  const pending = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-KEEP)));
    } catch {
      /* Private browsing can block storage. */
    }
    const list = listRef.current;
    if (list !== null) list.scrollTop = list.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    if (preview) return;
    let live = true;
    const refresh = () => {
      void fetchTaskPlaces().then((result) => {
        if (live && result.ok) setPlaces(result.value);
      });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      live = false;
      window.removeEventListener('focus', refresh);
    };
  }, [preview]);

  const deps: ActionDeps = {
    onOpen,
    setSound: sound.setEnabled,
    setAlerts: alerts.setEnabled,
  };
  const depsRef = useRef(deps);
  useEffect(() => {
    depsRef.current = deps;
  });

  const settle = useCallback((messageId: number, index: number, outcome: Outcome) => {
    setMessages((items) =>
      items.map((m) =>
        m.id === messageId ? { ...m, outcomes: { ...m.outcomes, [index]: outcome } } : m,
      ),
    );
  }, []);

  /** Asks MON MANG; true once the message is on its way (the box then empties). */
  const send = async (text: string): Promise<boolean> => {
    const message = text.trim();
    if (message === '' || busy || preview) return false;
    const history = historyOf(messages);
    setMessages((items) => [...items, { id: newId(), role: 'user', content: message }]);
    setInput('');
    setStopped(false);
    setBusy(true);
    const controller = new AbortController();
    pending.current = controller;
    const result = await askAssistant(
      { message, history, persona: getPersona() },
      controller.signal,
    );
    // Stopped meanwhile: the answer is dropped.
    if (controller.signal.aborted) return true;
    pending.current = null;
    const id = newId();
    setMessages((items) => [
      ...items,
      result.ok
        ? { id, role: 'assistant', content: result.value.reply, response: result.value }
        : { id, role: 'assistant', content: result.error, failed: true },
    ]);
    setBusy(false);
    if (!result.ok) return true;
    // Harmless actions happen right away; the rest wait on their buttons.
    for (const [index, action] of result.value.actions.entries()) {
      if (!runsAtOnce(action)) continue;
      settle(id, index, await runAction(action, depsRef.current));
    }
    return true;
  };

  const cancel = () => {
    pending.current?.abort();
    pending.current = null;
    setBusy(false);
    setStopped(true);
  };
  // Leaving the page drops an answer still on its way.
  useEffect(
    () => () => {
      pending.current?.abort();
    },
    [],
  );

  const suggest = (s: Suggestion) => {
    if (s.send) {
      void send(s.text);
      return;
    }
    setInput(s.text);
    inputRef.current?.focus();
  };

  const waiting = agents.filter((a) => a.state === 'needs-you');
  const working = agents.filter((a) => zoneOf(a.state) === 'table' && a.state !== 'needs-you');
  const resting = agents.filter((a) => zoneOf(a.state) === 'lounge');
  const accent = { '--persona': COLOR_HEX[persona.color] } as CSSProperties;

  return (
    <Page
      trail={['Assistant']}
      fill
      actions={
        <>
          <Button
            size="sm"
            icon={<AppearanceIcon size={16} />}
            onClick={() => {
              navigate('settings', 'assistant');
            }}
          >
            Personality
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={messages.length === 0 || busy}
            onClick={() => {
              setMessages([]);
            }}
          >
            Clear chat
          </Button>
        </>
      }
    >
      <div className={styles.layout} style={accent}>
        <section className={styles.chat} aria-label="Conversation with MON MANG">
          <div className={styles.messages} ref={listRef} aria-live="polite">
            <Bubble persona={persona.color} name="MON MANG">
              <p>{greeting(persona)}</p>
              {messages.length === 0 && (
                <div className={styles.chips}>
                  {SUGGESTIONS.map((s) => (
                    <Button
                      key={s.text}
                      size="sm"
                      className={styles.chip}
                      disabled={preview || busy}
                      onClick={() => {
                        suggest(s);
                      }}
                    >
                      {s.send ? s.text : `${s.text.trim()}…`}
                    </Button>
                  ))}
                </div>
              )}
            </Bubble>
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className={styles.user}>
                  <p>{m.content}</p>
                </div>
              ) : (
                <Bubble key={m.id} persona={persona.color} name="MON MANG" failed={m.failed}>
                  <p>{m.content}</p>
                  {m.response !== undefined && m.response.matches.length > 0 && (
                    <ul className={styles.matches}>
                      {m.response.matches.map((repo) => (
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
                  {m.response !== undefined && m.response.actions.length > 0 && (
                    <div className={styles.actions}>
                      {m.response.actions.map((action, index) => (
                        <ActionCard
                          key={`${String(m.id)}-${String(index)}`}
                          action={action}
                          outcome={m.outcomes?.[index]}
                          onSettled={(outcome) => {
                            settle(m.id, index, outcome);
                          }}
                          agents={agents}
                          places={places}
                          matches={m.response?.matches ?? []}
                          preview={preview}
                          {...deps}
                        />
                      ))}
                    </div>
                  )}
                </Bubble>
              ),
            )}
            {busy && (
              <div className={styles.thinking} role="status">
                <MonAvatar color={persona.color} size={28} busy />
                MON MANG is thinking…
              </div>
            )}
          </div>
          <MessageBox
            ref={inputRef}
            variant="page"
            value={input}
            onChange={(next) => {
              setInput(next);
              setStopped(false);
            }}
            onSubmit={() => send(input)}
            label="Message MON MANG"
            placeholder="บอก MON MANG ได้เลย เช่น ให้ Codex แก้หน้า login ใน ai-hub-frontend หรือ ตอบ agent ที่รออยู่ว่า yes"
            disabled={preview}
            busy={busy}
            maxLength={4_000}
            stop={
              busy
                ? {
                    onStop: cancel,
                    label: 'Stop MON MANG',
                    title: 'Stop: MON MANG drops this answer.',
                  }
                : null
            }
            hint={() =>
              preview
                ? 'MON MANG needs the local server.'
                : busy
                  ? 'MON MANG is thinking… The button stops it.'
                  : stopped
                    ? 'Stopped. Ask again when you are ready.'
                    : 'Enter sends, Shift+Enter for a new line. Starting work, writing to agents and making files wait for your click.'
            }
            hintKind={stopped && !busy ? 'stopped' : undefined}
          />
        </section>

        <aside className={styles.side} aria-label="MON MANG at a glance">
          <Card className={styles.who}>
            <MonAvatar color={persona.color} size={52} busy={busy} />
            <div className={styles.whoText}>
              <strong>MON MANG</strong>
              <span>
                {STYLE_META[persona.style].emoji} {personaSummary(persona)}
              </span>
            </div>
            <Button
              size="sm"
              variant="link"
              onClick={() => {
                navigate('settings', 'assistant');
              }}
            >
              Change
            </Button>
          </Card>

          <Card className={styles.panel}>
            <h2 className={styles.panelTitle}>Right now</h2>
            <ul className={styles.counts}>
              <li data-urgent={waiting.length > 0 || undefined}>
                <NeedsYouIcon size={16} /> Needs you <strong>{waiting.length}</strong>
              </li>
              <li>
                <WorkIcon size={16} /> Working <strong>{working.length}</strong>
              </li>
              <li>
                <CampIcon size={16} /> Resting <strong>{resting.length}</strong>
              </li>
            </ul>
            {waiting.length > 0 && (
              <ul className={styles.waiting}>
                {waiting.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={styles.waitingButton}
                      onClick={() => {
                        onOpen(a.id);
                      }}
                    >
                      {a.desk}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {agents.length > 0 && (
              <Button
                size="sm"
                disabled={preview || busy}
                onClick={() => {
                  void send('สรุปสถานะ agents ตอนนี้ให้หน่อย ใครต้องการอะไรจากฉันบ้าง');
                }}
              >
                Ask for a summary
              </Button>
            )}
          </Card>

          <Card className={styles.panel}>
            <h2 className={styles.panelTitle}>What MON MANG can do</h2>
            <ul className={styles.canDo}>
              {CAN_DO.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className={styles.note}>
              Starting work, writing to agents and making files always wait for your click.
            </p>
          </Card>
        </aside>
      </div>
    </Page>
  );
}

function Bubble({
  persona,
  name,
  failed,
  children,
}: {
  readonly persona: Parameters<typeof MonAvatar>[0]['color'];
  readonly name: string;
  readonly failed?: boolean | undefined;
  readonly children: React.ReactNode;
}) {
  return (
    <div className={styles.assistant} data-failed={failed === true || undefined}>
      <MonAvatar color={persona} size={32} />
      <div className={styles.bubble}>
        <span className={styles.speaker}>{name}</span>
        {children}
      </div>
    </div>
  );
}
