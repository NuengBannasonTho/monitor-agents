import type { Agent } from '@agent-office/shared';
import { MAX_SEND_CHARS, zoneOf } from '@agent-office/shared';
import { useEffect, useState } from 'react';
import { interruptAgent, sendToAgent } from '../../live/sendToAgent';
import { MessageBox } from '../ui/MessageBox';

type Status =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending'; readonly files: number }
  | { readonly kind: 'sent'; readonly files: number }
  | { readonly kind: 'stopping' }
  | { readonly kind: 'stopped' }
  | { readonly kind: 'error'; readonly message: string };

const plural = (n: number): string => `${String(n)} file${n === 1 ? '' : 's'}`;

/**
 * Talk to the agent without its terminal: what you write is typed into its Orca terminal as
 * a prompt, as if you had typed it there, with any files you attach, paste or drop pointed at
 * by @path. Enter sends, Shift+Enter is a new line; the button stops it, like Esc.
 */
export function Composer({ agent }: { agent: Agent }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const reachable = agent.kind === 'claude-code' && agent.terminal !== undefined;
  const sending = status.kind === 'sending' || status.kind === 'stopping';
  // At work (or waiting on you): there is something to stop.
  const working = zoneOf(agent.state) === 'table';

  // "Sent" and "Stopped" fade back to the hint after a moment.
  useEffect(() => {
    if (status.kind !== 'sent' && status.kind !== 'stopped') return;
    const timer = setTimeout(() => {
      setStatus({ kind: 'idle' });
    }, 3_000);
    return () => {
      clearTimeout(timer);
    };
  }, [status]);

  const submit = async (files: readonly File[]): Promise<boolean> => {
    setStatus({ kind: 'sending', files: files.length });
    const result = await sendToAgent(agent.id, text.trim(), files);
    if (!result.ok) {
      setStatus({ kind: 'error', message: result.error });
      return false;
    }
    setStatus({ kind: 'sent', files: files.length });
    setText('');
    return true;
  };

  const stop = async (): Promise<void> => {
    if (sending || !reachable) return;
    setStatus({ kind: 'stopping' });
    const result = await interruptAgent(agent.id);
    setStatus(result.ok ? { kind: 'stopped' } : { kind: 'error', message: result.error });
  };

  const hint = (attached: number): string => {
    switch (status.kind) {
      case 'error':
        return status.message;
      case 'sent':
        return `Sent to ${agent.desk}${status.files > 0 ? ` with ${plural(status.files)}` : ''}. It shows in Activity as the agent picks it up.`;
      case 'stopped':
        return `Stopped ${agent.desk}. Write a message to carry on.`;
      case 'stopping':
        return 'Stopping…';
      case 'sending':
        return status.files > 0 ? `Sending with ${plural(status.files)}…` : 'Sending…';
      case 'idle':
        if (!reachable) return 'Typing from here works for Claude Code agents running in Orca.';
        if (working && text.trim() === '' && attached === 0)
          return `${agent.desk} is working: the button stops it (like Esc). Write to send it more.`;
        return 'Enter sends, Shift+Enter for a new line. Paste or drop images and files to attach.';
    }
  };

  return (
    <MessageBox
      value={text}
      onChange={(next) => {
        setText(next);
        if (status.kind === 'error') setStatus({ kind: 'idle' });
      }}
      onSubmit={submit}
      label={`Message to ${agent.desk}`}
      placeholder={
        !reachable
          ? 'This agent runs outside Orca: type in its own terminal'
          : agent.state === 'needs-you'
            ? `Answer ${agent.desk}…`
            : `Message ${agent.desk}…`
      }
      {...(agent.state === 'needs-you' ? {} : { placeholderWithFiles: 'Say what to do with them…' })}
      disabled={!reachable}
      busy={sending}
      maxLength={MAX_SEND_CHARS}
      attachments
      stop={
        working && reachable
          ? {
              onStop: () => {
                void stop();
              },
              label: `Stop ${agent.desk}`,
              title: 'Stop: like pressing Esc in its terminal. The session stays open.',
              disabled: sending,
            }
          : null
      }
      hint={hint}
      hintKind={
        status.kind === 'error' || status.kind === 'stopped' || status.kind === 'sent'
          ? status.kind
          : undefined
      }
    />
  );
}
