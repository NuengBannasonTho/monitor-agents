import type { Agent } from '@agent-office/shared';
import { MAX_SEND_CHARS, MAX_SEND_FILE_BYTES, MAX_SEND_FILES, zoneOf } from '@agent-office/shared';
import type { ClipboardEvent, DragEvent, KeyboardEvent } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cx } from '../../lib/cx';
import { interruptAgent, sendToAgent } from '../../live/sendToAgent';
import { ArrowIcon, AttachIcon, CloseIcon, FileIcon } from '../icons';
import styles from './Composer.module.css';

type Status =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'sent'; readonly files: number }
  | { readonly kind: 'stopping' }
  | { readonly kind: 'stopped' }
  | { readonly kind: 'error'; readonly message: string };

/** A file waiting to go with the next message; images get a thumbnail. */
interface Attachment {
  readonly id: string;
  readonly file: File;
  readonly preview: string | null;
}

/** Lines the box grows to before it scrolls. */
const MAX_ROWS = 8;
/*
 * Sizes in px, matching Composer.module.css: one line of text is as tall as the buttons, so
 * a one-line box is a single row (attach · text · send); past one line it grows, the text
 * takes the card's full width and the buttons slide to a row of their own below.
 */
const LINE_PX = 22;
const TEXT_PAD_PX = 10;
const ONE_LINE_PX = LINE_PX + TEXT_PAD_PX * 2;
const MAX_BOX_PX = LINE_PX * MAX_ROWS + TEXT_PAD_PX * 2;
const CARD_PAD_PX = 8;
/** Room beside the text on one line: the attach button on the left, send on the right. */
const SIDE_LEFT_PX = 44;
const SIDE_RIGHT_PX = 50;
/** Inset of the text once it has the card to itself. */
const WIDE_SIDE_PX = 8;
/** Attachments drawn peeking above the box; the rest are counted. */
const SHOWN_TILES = 5;

let nextId = 0;

function attach(file: File): Attachment {
  nextId += 1;
  // A pasted screenshot is just "image.png": give it a name worth keeping.
  const named =
    file.name === '' || /^image\.(png|jpe?g|gif|webp)$/i.test(file.name)
      ? new File(
          [file],
          `pasted-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}-${String(nextId)}.${file.type.split('/')[1] ?? 'png'}`,
          { type: file.type },
        )
      : file;
  return {
    id: String(nextId),
    file: named,
    preview: named.type.startsWith('image/') ? URL.createObjectURL(named) : null,
  };
}

function extension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1, dot + 5).toUpperCase() : 'FILE';
}

/**
 * Talk to the agent without its terminal: what you write is typed into its Orca terminal as
 * a prompt, as if you had typed it there, with any files you attach, paste or drop pointed at
 * by @path. Enter sends, Shift+Enter is a new line; the red button stops it, like Esc.
 */
export function Composer({ agent }: { agent: Agent }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<readonly Attachment[]>([]);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [dragging, setDragging] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const reachable = agent.kind === 'claude-code' && agent.terminal !== undefined;
  const sending = status.kind === 'sending' || status.kind === 'stopping';
  // At work (or waiting on you): there is something to stop.
  const busy = zoneOf(agent.state) === 'table';
  const hasContent = text.trim() !== '' || files.length > 0;
  const canSend = reachable && !sending && hasContent;
  // The one button stops a busy agent until there is something to send.
  const stopMode = busy && reachable && !hasContent;

  // One line until the text needs more (it wraps, or Shift+Enter); then it grows to fit,
  // up to MAX_ROWS lines, and stays roomy until the box is empty again. Heights come from an
  // invisible copy of the text at the width it will have, so the box never jumps or flickers
  // while the layout switches.
  const card = useRef<HTMLDivElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLButtonElement>(null);
  const [roomy, setRoomy] = useState(false);
  const [boxPx, setBoxPx] = useState(ONE_LINE_PX);
  const [cardPx, setCardPx] = useState(0);

  useLayoutEffect(() => {
    const el = card.current;
    if (el === null) return;
    const observer = new ResizeObserver(() => {
      setCardPx(el.clientWidth);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const copy = mirror.current;
    if (copy === null || cardPx === 0) return;
    const chipPx = chip.current === null ? 0 : chip.current.offsetWidth + 8;
    const inner = cardPx - CARD_PAD_PX * 2 - chipPx;
    const heightAt = (width: number): number => {
      copy.style.width = `${String(Math.max(40, width))}px`;
      // A trailing newline still takes a line.
      copy.textContent = `${text}\u200b`;
      return copy.scrollHeight;
    };
    let next = roomy;
    if (
      !next &&
      (text.includes('\n') || heightAt(inner - SIDE_LEFT_PX - SIDE_RIGHT_PX) > ONE_LINE_PX + 1)
    ) {
      next = true;
    }
    if (next && text === '') next = false;
    if (next !== roomy) setRoomy(next);
    setBoxPx(next ? Math.min(heightAt(inner - WIDE_SIDE_PX * 2), MAX_BOX_PX) : ONE_LINE_PX);
  }, [text, roomy, cardPx, files.length]);

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

  // Thumbnails are object URLs: free the ones no longer shown (and all of them on close).
  const shown = useRef(files);
  useEffect(() => {
    const before = shown.current;
    shown.current = files;
    for (const f of before) {
      if (f.preview !== null && !files.includes(f)) URL.revokeObjectURL(f.preview);
    }
  }, [files]);
  useEffect(
    () => () => {
      for (const f of shown.current) if (f.preview !== null) URL.revokeObjectURL(f.preview);
    },
    [],
  );

  const add = (incoming: readonly File[]): void => {
    if (incoming.length === 0) return;
    const tooBig = incoming.filter((f) => f.size > MAX_SEND_FILE_BYTES);
    const fits = incoming.filter((f) => f.size <= MAX_SEND_FILE_BYTES && f.size > 0);
    const room = MAX_SEND_FILES - files.length;
    const taken = fits.slice(0, Math.max(0, room));
    if (taken.length > 0) setFiles([...files, ...taken.map(attach)]);
    if (tooBig.length > 0) {
      setStatus({
        kind: 'error',
        message: `Over 10 MB, left out: ${tooBig.map((f) => f.name).join(', ')}`,
      });
    } else if (taken.length < fits.length) {
      setStatus({ kind: 'error', message: `Up to ${String(MAX_SEND_FILES)} files per message.` });
    }
    box.current?.focus();
  };

  const remove = (id: string): void => {
    setFiles(files.filter((f) => f.id !== id));
  };

  const submit = async (): Promise<void> => {
    if (!canSend) return;
    setStatus({ kind: 'sending' });
    const result = await sendToAgent(
      agent.id,
      text.trim(),
      files.map((f) => f.file),
    );
    if (result.ok) {
      setStatus({ kind: 'sent', files: files.length });
      setText('');
      setFiles([]);
    } else {
      setStatus({ kind: 'error', message: result.error });
    }
  };

  const stop = async (): Promise<void> => {
    if (sending || !reachable) return;
    setStatus({ kind: 'stopping' });
    const result = await interruptAgent(agent.id);
    setStatus(result.ok ? { kind: 'stopped' } : { kind: 'error', message: result.error });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    // Enter sends; Shift+Enter (or Enter while an input method is composing) does not.
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void submit();
  };

  // Pasting a screenshot (or copied files) attaches them; pasted text stays text.
  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>): void => {
    const pasted = [...event.clipboardData.files];
    if (pasted.length === 0) return;
    event.preventDefault();
    add(pasted);
  };

  const onDrop = (event: DragEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setDragging(false);
    if (reachable) add([...event.dataTransfer.files]);
  };

  const placeholder = !reachable
    ? 'This agent runs outside Orca: type in its own terminal'
    : agent.state === 'needs-you'
      ? `Answer ${agent.desk}…`
      : files.length > 0
        ? 'Say what to do with them…'
        : `Message ${agent.desk}…`;

  const hint =
    status.kind === 'error'
      ? status.message
      : status.kind === 'sent'
        ? `Sent to ${agent.desk}${status.files > 0 ? ` with ${String(status.files)} file${status.files === 1 ? '' : 's'}` : ''}. It shows in Activity as the agent picks it up.`
        : status.kind === 'stopped'
          ? `Stopped ${agent.desk}. Write a message to carry on.`
          : status.kind === 'stopping'
            ? 'Stopping…'
            : status.kind === 'sending'
              ? files.length > 0
                ? `Sending with ${String(files.length)} file${files.length === 1 ? '' : 's'}…`
                : 'Sending…'
              : stopMode
                ? `${agent.desk} is working: the button stops it (like Esc). Write to send it more.`
                : reachable
                  ? 'Enter sends, Shift+Enter for a new line. Paste or drop images and files to attach.'
                  : 'Typing from here works for Claude Code agents running in Orca.';

  const tiles = files.slice(0, SHOWN_TILES);
  const more = files.length - tiles.length;

  return (
    <form
      className={styles.composer}
      data-vaul-no-drag
      data-dragging={dragging ? 'true' : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      onDragOver={(event) => {
        if (!reachable || !event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={onDrop}
    >
      {files.length > 0 && (
        <ul className={styles.stack} aria-label="Attached files">
          {tiles.map((f, i) => (
            <li
              key={f.id}
              className={styles.tile}
              style={{
                ['--i' as string]: i,
                ['--tilt' as string]: `${String((i % 2 === 0 ? -1 : 1) * (3 + i))}deg`,
              }}
              title={f.file.name}
            >
              {f.preview === null ? (
                <span className={styles.doc}>
                  <FileIcon size={18} />
                  <span className={styles.ext}>{extension(f.file.name)}</span>
                </span>
              ) : (
                <img className={styles.thumb} src={f.preview} alt="" />
              )}
              <button
                type="button"
                className={styles.removeTile}
                onClick={() => {
                  remove(f.id);
                }}
                aria-label={`Remove ${f.file.name}`}
              >
                <CloseIcon size={11} />
              </button>
            </li>
          ))}
          {more > 0 && (
            <li
              className={cx(styles.tile, styles.moreTile)}
              style={{ ['--i' as string]: tiles.length }}
            >
              +{more}
            </li>
          )}
        </ul>
      )}

      <div
        ref={card}
        className={styles.card}
        data-roomy={roomy ? 'true' : undefined}
        data-disabled={reachable ? undefined : 'true'}
      >
        <div className={styles.line}>
          {files.length > 0 && (
            <button
              ref={chip}
              type="button"
              className={styles.chip}
              onClick={() => {
                setFiles([]);
              }}
              title="Remove all attachments"
            >
              {files.length} file{files.length === 1 ? '' : 's'}
              <CloseIcon size={11} />
            </button>
          )}
          <textarea
            ref={box}
            className={styles.input}
            rows={1}
            style={{ height: boxPx, overflowY: boxPx >= MAX_BOX_PX ? 'auto' : 'hidden' }}
            value={text}
            maxLength={MAX_SEND_CHARS}
            placeholder={placeholder}
            disabled={!reachable}
            aria-label={`Message to ${agent.desk}`}
            onChange={(event) => {
              setText(event.target.value);
              if (status.kind === 'error') setStatus({ kind: 'idle' });
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
          />
          {/* Measures how tall the text would be at a given width (never shown). */}
          <div ref={mirror} className={styles.mirror} aria-hidden />
        </div>

        <button
          type="button"
          className={styles.tool}
          disabled={!reachable || files.length >= MAX_SEND_FILES}
          onClick={() => picker.current?.click()}
          aria-label="Attach files"
          title="Attach images or files (or paste / drop them here)"
        >
          <AttachIcon size={20} />
        </button>
        <input
          ref={picker}
          className={styles.picker}
          type="file"
          multiple
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            add([...(event.target.files ?? [])]);
            event.target.value = '';
          }}
        />
        {/* One button, as in Claude: it stops a busy agent while there is nothing to send,
            and sends (the agent queues it) once you write or attach something. */}
        <button
          type="button"
          className={styles.send}
          data-mode={stopMode ? 'stop' : 'send'}
          disabled={stopMode ? sending : !canSend}
          onClick={() => {
            void (stopMode ? stop() : submit());
          }}
          aria-label={stopMode ? `Stop ${agent.desk}` : 'Send'}
          title={
            stopMode
              ? 'Stop: like pressing Esc in its terminal. The session stays open.'
              : 'Send (Enter)'
          }
        >
          <span className={styles.sendIcon} aria-hidden>
            {stopMode ? <span className={styles.stopSquare} /> : <ArrowIcon size={20} />}
          </span>
        </button>
      </div>

      <p className={styles.status} data-kind={status.kind} role="status">
        {hint}
      </p>
    </form>
  );
}
