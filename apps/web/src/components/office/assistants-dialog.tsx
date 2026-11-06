import type { CustomAgent } from '@agent-office/shared';
import { useEffect, useRef } from 'react';
import { hashString } from '../../lib/seed';
import { navigate } from '../../lib/route';
import { Avatar } from '../avatar/avatar';
import { COLOR_HEX } from '../../lib/agent-colors';
import { CloseIcon } from '../icons';
import { KindBadge } from './kind-badge';
import styles from './assistants-dialog.module.css';

interface Props {
  readonly helpers: readonly CustomAgent[];
  readonly onClose: () => void;
  readonly onAssignHelper: (helper: CustomAgent) => void;
  readonly onAssignProvider: (provider: 'claude' | 'codex') => void;
}

/** Saved assistants are launch choices; live sessions remain in the office scene. */
export function AssistantsDialog({ helpers, onClose, onAssignHelper, onAssignProvider }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="assistants-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.header}>
        <div>
          <h2 id="assistants-title">Assistants</h2>
          <p>Choose who should take the next task. A new session starts when you press Start.</p>
        </div>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close assistants"
          autoFocus
        >
          <CloseIcon size={18} />
        </button>
      </div>

      <h3>Start an agent</h3>
      <ul className={styles.grid}>
        {(['claude', 'codex'] as const).map((provider) => (
          <li key={provider}>
            <button
              type="button"
              className={styles.card}
              onClick={() => {
                onAssignProvider(provider);
              }}
            >
              <Avatar
                state="idle"
                desk={provider}
                hue={hashString(provider) % 360}
                seed={`provider:${provider}`}
                variant="thumb"
              />
              <span className={styles.details}>
                <strong>
                  <KindBadge kind={provider === 'claude' ? 'claude-code' : 'codex'} size={14} />
                  {provider === 'claude' ? 'Claude Code' : 'Codex'}
                </strong>
                <small>Start a new task</small>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.sectionHeading}>
        <h3>
          Saved helpers <span>{helpers.length}</span>
        </h3>
        <button
          type="button"
          onClick={() => {
            onClose();
            navigate('custom-agents');
          }}
        >
          Manage
        </button>
      </div>
      {helpers.length === 0 ? (
        <p className={styles.empty}>
          Create a custom agent to give it a role and keep it here for later work.
        </p>
      ) : (
        <ul className={styles.grid}>
          {helpers.map((helper) => {
            const seed = `${helper.scope}\n${helper.file}`;
            const color =
              helper.color && helper.color in COLOR_HEX
                ? COLOR_HEX[helper.color as keyof typeof COLOR_HEX]
                : undefined;
            return (
              <li key={seed}>
                <button
                  type="button"
                  className={styles.card}
                  onClick={() => {
                    onAssignHelper(helper);
                  }}
                  title={helper.description}
                >
                  <Avatar
                    state="idle"
                    desk={helper.name}
                    hue={hashString(seed) % 360}
                    seed={seed}
                    variant="thumb"
                  />
                  <span className={styles.details}>
                    <strong>{helper.name}</strong>
                    <small>
                      {helper.scope === 'user' ? 'Yours' : helper.scope.split('/').pop()}
                    </small>
                  </span>
                  <span className={styles.color} style={{ backgroundColor: color }} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </dialog>
  );
}
