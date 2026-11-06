import { CopyButton, CopyButtonIcon } from '@animate-ui/react/primitives/buttons/copy';
import { CodeBlock } from '@animate-ui/react/primitives/code-block';
import { useTheme } from '../../lib/theme';
import { CopiedIcon, CopyIcon } from '../icons';
import styles from './code-view.module.css';

/** Code this short types itself out when it first appears; longer code shows at once. */
const TYPE_OUT_MAX_CHARS = 600;
/** Languages the server picks, so they always load (typing waits on the highlighter). */
const KNOWN_LANGS: ReadonlySet<string> = new Set([
  'text',
  'shellscript',
  'diff',
  'json',
  'regexp',
  'typescript',
  'tsx',
  'javascript',
  'jsx',
  'css',
  'html',
  'markdown',
  'python',
  'yaml',
]);

/** Output and commands wrap to the panel; code keeps its lines and scrolls sideways. */
const WRAPPED_LANGS: ReadonlySet<string> = new Set(['text', 'shellscript']);

/** Names shown for the highlighting languages we use. */
const LANG_LABEL: Readonly<Record<string, string>> = {
  shellscript: 'shell',
  text: '',
  plaintext: '',
  diff: 'diff',
};

interface CodeViewProps {
  readonly label: string;
  readonly code: string;
  /** A Shiki language id; unknown ones stay as plain text. */
  readonly lang: string;
}

/**
 * A highlighted code block (a command, a diff, file content, output) with its label and a
 * copy button. The plain text shows until the highlighter has loaded.
 */
export function CodeView({ label, code, lang }: CodeViewProps) {
  const theme = useTheme().resolved;
  const typeOut = code.length <= TYPE_OUT_MAX_CHARS && KNOWN_LANGS.has(lang);
  const langLabel = LANG_LABEL[lang] ?? lang;

  return (
    <figure className={styles.frame}>
      <figcaption className={styles.header}>
        <span className={styles.label}>{label}</span>
        {langLabel !== '' && <span className={styles.lang}>{langLabel}</span>}
        <CopyButton className={styles.copy} content={code} aria-label={`Copy ${label}`}>
          <CopyButtonIcon icon={<CopyIcon size={13} />} copiedIcon={<CopiedIcon size={13} />} />
        </CopyButton>
      </figcaption>
      {/* Lets you select text without the drawer taking the drag as a swipe to close. */}
      <div
        className={styles.scroll}
        data-vaul-no-drag
        data-wrap={WRAPPED_LANGS.has(lang) ? 'true' : undefined}
      >
        <pre className={styles.fallback}>{code}</pre>
        <CodeBlock
          className={styles.code}
          code={code}
          lang={lang}
          theme={theme}
          writing={typeOut}
          duration={Math.min(1_000, Math.max(300, code.length * 3))}
        />
      </div>
    </figure>
  );
}
