import type { ActivityEntry, DetailPart } from '@agent-office/shared';
import type { ReactNode } from 'react';
import { formatClock } from '../../lib/relative-time';
import styles from './activity-detail.module.css';
import { CodeView } from './code-view';
import { splitFences } from './fences';

type FieldPart = Extract<DetailPart, { type: 'field' }>;

/** Runs of short fields share one list; everything else stands alone. */
type Block =
  | { readonly kind: 'fields'; readonly fields: readonly FieldPart[] }
  | { readonly kind: 'part'; readonly part: Exclude<DetailPart, FieldPart> };

function blocksOf(parts: readonly DetailPart[]): Block[] {
  const blocks: Block[] = [];
  for (const part of parts) {
    const last = blocks.at(-1);
    if (part.type === 'field') {
      if (last?.kind === 'fields') {
        blocks[blocks.length - 1] = { kind: 'fields', fields: [...last.fields, part] };
      } else {
        blocks.push({ kind: 'fields', fields: [part] });
      }
    } else {
      blocks.push({ kind: 'part', part });
    }
  }
  return blocks;
}

interface ActivityDetailProps {
  readonly entry: ActivityEntry;
  /** The server records details (some line of this agent has them). */
  readonly recording: boolean;
}

/**
 * Everything behind one activity line: the command and its output, the diff, the prompt,
 * Claude's reply. A line without a detail shows the whole line and when it happened, and
 * says why there is nothing more when the server is not recording details.
 */
export function ActivityDetail({ entry, recording }: ActivityDetailProps): React.JSX.Element {
  const parts = entry.detail ?? [];
  const when: FieldPart = { type: 'field', label: 'At', value: formatClock(entry.at) };

  if (parts.length === 0) {
    return (
      <div className={styles.detail}>
        <p className={styles.line}>{entry.summary}</p>
        {!recording && (
          <p className={styles.note}>
            No prompt, code or output was recorded for this step: the server was started before
            activity details were added. Restart it (Ctrl+C, then <code>pnpm start</code>) and new
            steps will show them.
          </p>
        )}
        <Fields fields={[when]} />
      </div>
    );
  }

  const blocks = blocksOf([...parts, when]);
  return (
    <div className={styles.detail}>
      {blocks.map((block, i) =>
        block.kind === 'fields' ? (
          <Fields key={i} fields={block.fields} />
        ) : block.part.type === 'code' ? (
          <CodeView
            key={i}
            label={block.part.label}
            code={block.part.code}
            lang={block.part.lang}
          />
        ) : (
          <Prose key={i} label={block.part.label} text={block.part.text} />
        ),
      )}
    </div>
  );
}

function Fields({ fields }: { fields: readonly FieldPart[] }) {
  return (
    <dl className={styles.fields}>
      {fields.map((f, j) => (
        <div key={j} className={styles.field}>
          <dt>{f.label}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Prose such as a prompt or a reply; fenced code in it becomes a code block. */
function Prose({ label, text }: { label: string; text: string }) {
  const segments = splitFences(text);
  return (
    <section className={styles.prose}>
      <h4 className={styles.proseLabel}>{label}</h4>
      {segments.map((s, i) =>
        s.kind === 'code' ? (
          <CodeView key={i} label="Code" code={s.code} lang={s.lang} />
        ) : (
          <p key={i} className={styles.text}>
            {withInlineCode(s.text)}
          </p>
        ),
      )}
    </section>
  );
}

/** `name` in prose renders as inline code. */
function withInlineCode(text: string): ReactNode[] {
  return text
    .split(/(`[^`\n]+`)/)
    .map((piece, i) =>
      piece.length > 2 && piece.startsWith('`') && piece.endsWith('`') ? (
        <code key={i}>{piece.slice(1, -1)}</code>
      ) : (
        piece
      ),
    );
}
