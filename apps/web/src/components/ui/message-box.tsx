import { MAX_SEND_FILE_BYTES, MAX_SEND_FILES } from '@agent-office/shared';
import type { ClipboardEvent, DragEvent, KeyboardEvent, ReactNode, Ref } from 'react';
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { cx } from '../../lib/cx';
import { ArrowIcon, AttachIcon, CloseIcon, FileIcon } from '../icons';
import styles from './message-box.module.css';

/** A file waiting to go with the next message; images get a thumbnail. */
interface Attachment {
  readonly id: string;
  readonly file: File;
  readonly preview: string | null;
}

/** Lines the box grows to before it scrolls. */
const MAX_ROWS = 8;
/*
 * Sizes in px, matching message-box.module.css: one line of text is as tall as the buttons, so
 * a one-line box is a single row (attach · text · send); past one line it grows, the text
 * takes the card's full width and the buttons slide to a row of their own below.
 */
const LINE_PX = 22;
const TEXT_PAD_PX = 10;
const ONE_LINE_PX = LINE_PX + TEXT_PAD_PX * 2;
const MAX_BOX_PX = LINE_PX * MAX_ROWS + TEXT_PAD_PX * 2;
const CARD_PAD_PX = 8;
/** Room beside the text on one line: the attach button (or a little inset) left, send right. */
const SIDE_LEFT_PX = 44;
const SIDE_LEFT_BARE_PX = 14;
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

/** Puts the cursor in the box (after a suggestion fills it, say). */
export interface MessageBoxHandle {
  focus: () => void;
}

export interface MessageBoxProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  /**
   * Sends what is written, with the attached files; resolves true once it went, which empties
   * the attachments (the text is yours to clear in `onChange`'s state).
   */
  readonly onSubmit: (files: readonly File[]) => Promise<boolean>;
  /** The box's accessible name. */
  readonly label: string;
  readonly placeholder: string;
  /** The placeholder while files are attached and nothing is written yet. */
  readonly placeholderWithFiles?: string;
  /** Nothing can be written or sent (the agent is out of reach). */
  readonly disabled?: boolean;
  /** Sending or stopping right now: the button waits. */
  readonly busy?: boolean;
  readonly maxLength?: number;
  /** Files can go with the message: the paperclip, paste and drop. */
  readonly attachments?: boolean;
  /**
   * While there is something to stop and nothing written, the send button turns into a stop
   * button (a square), as in Claude; writing turns it back.
   */
  readonly stop?: {
    readonly onStop: () => void;
    readonly label: string;
    readonly title: string;
    /** Already stopping. */
    readonly disabled?: boolean;
  } | null;
  readonly sendTitle?: string;
  /** The line under the box; given the number of attached files. */
  readonly hint: (attached: number) => ReactNode;
  /** Colors the hint: a problem in red, a success in green. */
  readonly hintKind?: 'error' | 'stopped' | 'sent' | undefined;
  /** drawer: pinned under a drawer on a white strip; page: on the page's own background. */
  readonly variant?: 'drawer' | 'page';
  readonly ref?: Ref<MessageBoxHandle>;
}

/**
 * The app's one box for writing to an agent or to MON MANG: a pill that grows into a card as
 * you write, files fanned behind its top edge, one round button that sends (or stops), and a
 * line under it. Enter sends, Shift+Enter is a new line.
 */
export function MessageBox({
  value,
  onChange,
  onSubmit,
  label,
  placeholder,
  placeholderWithFiles,
  disabled = false,
  busy = false,
  maxLength,
  attachments = false,
  stop = null,
  sendTitle = 'Send (Enter)',
  hint,
  hintKind,
  variant = 'drawer',
  ref,
}: MessageBoxProps): React.JSX.Element {
  const [files, setFiles] = useState<readonly Attachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => box.current?.focus() }), []);

  const hasContent = value.trim() !== '' || files.length > 0;
  const canSend = !disabled && !busy && hasContent;
  const stopMode = stop !== null && !disabled && !hasContent;
  const sideLeftPx = attachments ? SIDE_LEFT_PX : SIDE_LEFT_BARE_PX;

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
      copy.textContent = `${value}\u200b`;
      return copy.scrollHeight;
    };
    let next = roomy;
    if (
      !next &&
      (value.includes('\n') || heightAt(inner - sideLeftPx - SIDE_RIGHT_PX) > ONE_LINE_PX + 1)
    ) {
      next = true;
    }
    if (next && value === '') next = false;
    if (next !== roomy) setRoomy(next);
    setBoxPx(next ? Math.min(heightAt(inner - WIDE_SIDE_PX * 2), MAX_BOX_PX) : ONE_LINE_PX);
  }, [value, roomy, cardPx, files.length, sideLeftPx]);

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

  const handleAddFiles = (incoming: readonly File[]): void => {
    if (!attachments || incoming.length === 0) return;
    const tooBig = incoming.filter((f) => f.size > MAX_SEND_FILE_BYTES);
    const fits = incoming.filter((f) => f.size <= MAX_SEND_FILE_BYTES && f.size > 0);
    const room = MAX_SEND_FILES - files.length;
    const taken = fits.slice(0, Math.max(0, room));
    if (taken.length > 0) setFiles([...files, ...taken.map(attach)]);
    if (tooBig.length > 0) {
      setFileError(`Over 10 MB, left out: ${tooBig.map((f) => f.name).join(', ')}`);
    } else if (taken.length < fits.length) {
      setFileError(`Up to ${String(MAX_SEND_FILES)} files per message.`);
    }
    box.current?.focus();
  };

  const handleRemoveFile = (id: string): void => {
    setFiles(files.filter((f) => f.id !== id));
  };

  const handleSubmit = async (): Promise<void> => {
    if (!canSend) return;
    setFileError(null);
    if (await onSubmit(files.map((f) => f.file))) setFiles([]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    // Enter sends; Shift+Enter (or Enter while an input method is composing) does not.
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void handleSubmit();
  };

  // Pasting a screenshot (or copied files) attaches them; pasted text stays text.
  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>): void => {
    const pasted = [...event.clipboardData.files];
    if (!attachments || pasted.length === 0) return;
    event.preventDefault();
    handleAddFiles(pasted);
  };

  const onDrop = (event: DragEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) handleAddFiles([...event.dataTransfer.files]);
  };

  const tiles = files.slice(0, SHOWN_TILES);
  const more = files.length - tiles.length;

  return (
    <form
      className={styles.composer}
      data-variant={variant}
      data-vaul-no-drag
      data-dragging={dragging ? 'true' : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
      onDragOver={(event) => {
        if (!attachments || disabled || !event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        const to = event.relatedTarget;
        if (!(to instanceof Node && event.currentTarget.contains(to))) setDragging(false);
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
                '--i': i,
                '--tilt': `${String((i % 2 === 0 ? -1 : 1) * (3 + i))}deg`,
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
                  handleRemoveFile(f.id);
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
              style={{ '--i': tiles.length }}
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
        data-disabled={disabled ? 'true' : undefined}
        data-attach={attachments ? undefined : 'off'}
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
            value={value}
            maxLength={maxLength}
            placeholder={
              files.length > 0 && placeholderWithFiles !== undefined
                ? placeholderWithFiles
                : placeholder
            }
            disabled={disabled}
            aria-label={label}
            onChange={(event) => {
              onChange(event.target.value);
              setFileError(null);
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
          />
          {/* Measures how tall the text would be at a given width (never shown). */}
          <div ref={mirror} className={styles.mirror} aria-hidden />
        </div>

        {attachments && (
          <>
            <button
              type="button"
              className={styles.tool}
              disabled={disabled || files.length >= MAX_SEND_FILES}
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
                handleAddFiles([...(event.target.files ?? [])]);
                event.target.value = '';
              }}
            />
          </>
        )}
        {/* One button, as in Claude: it stops while there is something to stop and nothing to
            send, and sends once you write or attach something. */}
        <button
          type="button"
          className={styles.send}
          data-mode={stopMode ? 'stop' : 'send'}
          disabled={stopMode ? stop.disabled === true : !canSend}
          onClick={() => {
            if (stopMode) stop.onStop();
            else void handleSubmit();
          }}
          aria-label={stopMode ? stop.label : 'Send'}
          title={stopMode ? stop.title : sendTitle}
        >
          <span className={styles.sendIcon} aria-hidden>
            {stopMode ? <span className={styles.stopSquare} /> : <ArrowIcon size={20} />}
          </span>
        </button>
      </div>

      <p
        className={styles.status}
        data-kind={fileError !== null ? 'error' : hintKind}
        role="status"
      >
        {fileError ?? hint(files.length)}
      </p>
    </form>
  );
}
