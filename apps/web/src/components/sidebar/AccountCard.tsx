import type { AccountStatus, ClaudeAccount } from '@agent-office/shared';
import { Popover } from '@animate-ui/react/primitives/radix-ui/popover';
import type { CSSProperties } from 'react';
import { useAccount } from '../../live/account';
import { CopiedIcon, ExpandIcon } from '../icons';
import { Meter } from '../ui/Meter';
import styles from './AccountCard.module.css';

/** Where data comes from: the server stream status, or the static preview. */
export type Source = 'preview' | 'connecting' | 'live' | 'offline';

const SOURCE_LABEL: Readonly<Record<Source, string>> = {
  preview: 'Preview',
  connecting: 'Connecting',
  live: 'Live',
  offline: 'Offline',
};

const SOURCE_HINT: Readonly<Record<Source, string>> = {
  preview: 'Simulated agents running in your browser',
  connecting: 'Connecting to the MO BANANA server…',
  live: 'Connected to the MO BANANA server',
  offline: 'Server not reachable. Start it with pnpm start; reconnecting automatically.',
};

const initialOf = (email: string): string => email.trim().charAt(0).toUpperCase() || '?';

/** "25% of 5h · 4% week" under the account's name. */
function usageLine(status: AccountStatus | null): string | null {
  const session = status?.usage.session ?? null;
  if (session === null) return null;
  const weekly = status?.usage.weekly ?? null;
  return `${String(Math.round(session.usedPercent))}% of 5h${
    weekly === null ? '' : ` · ${String(Math.round(weekly.usedPercent))}% week`
  }`;
}

/**
 * The bottom of the sidebar: the Claude account the agents run on, its usage, and the
 * connection. Opens a card with every account Orca knows and the usage windows in full.
 */
export function AccountCard({ source, collapsed }: { source: Source; collapsed: boolean }) {
  const status = useAccount(source !== 'preview');
  const active = status?.accounts.find((a) => a.active) ?? null;
  const sessionWindow = status?.usage.session ?? null;
  const weeklyWindow = status?.usage.weekly ?? null;
  const session = sessionWindow?.usedPercent ?? null;
  const line = usageLine(status);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={styles.card}
          data-collapsed={collapsed || undefined}
          aria-label={`Account and usage. ${SOURCE_LABEL[source]}`}
          title={collapsed ? undefined : SOURCE_HINT[source]}
        >
          <Avatar email={active?.email ?? null} used={session} source={source} />
          <span className={styles.text}>
            <span className={styles.name}>{active?.email ?? SOURCE_LABEL[source]}</span>
            <span className={styles.meta}>
              {line ?? (active === null ? SOURCE_HINT[source] : SOURCE_LABEL[source])}
            </span>
          </span>
          <ExpandIcon size={14} className={styles.chevron} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={styles.panel}
          side={collapsed ? 'right' : 'top'}
          align={collapsed ? 'end' : 'start'}
          sideOffset={10}
        >
          <section className={styles.section}>
            <h2 className={styles.heading}>Claude account</h2>
            {status === null || status.accounts.length === 0 ? (
              <p className={styles.muted}>
                {status?.reachable !== true
                  ? 'Orca is not reachable, so the account is unknown. Open the Orca app.'
                  : 'No Claude account found.'}
              </p>
            ) : (
              <ul className={styles.accounts}>
                {status.accounts.map((account) => (
                  <AccountRow key={account.id} account={account} />
                ))}
              </ul>
            )}
            <p className={styles.note}>
              New agents start on the ticked account. To switch, pick another in Orca&apos;s
              settings; this list follows it.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.heading}>Usage</h2>
            {sessionWindow === null && weeklyWindow === null ? (
              <p className={styles.muted}>
                {status?.usage.error ?? 'Orca has no usage numbers yet.'}
              </p>
            ) : (
              <>
                {sessionWindow !== null && (
                  <Meter
                    label="This session (5 hours)"
                    percent={sessionWindow.usedPercent}
                    detail={
                      sessionWindow.resets === null ? undefined : `Resets ${sessionWindow.resets}`
                    }
                  />
                )}
                {weeklyWindow !== null && (
                  <Meter
                    label="This week"
                    percent={weeklyWindow.usedPercent}
                    detail={
                      weeklyWindow.resets === null ? undefined : `Resets ${weeklyWindow.resets}`
                    }
                  />
                )}
              </>
            )}
          </section>

          <footer className={styles.connection} data-source={source}>
            <span className={styles.dot} aria-hidden />
            {SOURCE_HINT[source]}
          </footer>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function AccountRow({ account }: { account: ClaudeAccount }) {
  return (
    <li className={styles.account} data-active={account.active || undefined}>
      <span className={styles.rowAvatar} aria-hidden>
        {initialOf(account.email)}
      </span>
      <span className={styles.rowText}>
        <span className={styles.rowEmail}>{account.email}</span>
        <span className={styles.rowKind}>
          {account.kind === 'system' ? 'Default login (~/.claude)' : 'Signed in through Orca'}
        </span>
      </span>
      {account.active && <CopiedIcon size={15} className={styles.tick} />}
    </li>
  );
}

/** The account's initial, ringed by how much of the 5-hour session is used, the connection on its corner. */
function Avatar({
  email,
  used,
  source,
}: {
  email: string | null;
  used: number | null;
  source: Source;
}) {
  return (
    <span
      className={styles.avatar}
      data-ring={used === null ? undefined : true}
      style={used === null ? undefined : ({ '--used': `${String(used)}%` } as CSSProperties)}
    >
      <span className={styles.initial}>{email === null ? '?' : initialOf(email)}</span>
      <span className={styles.status} data-source={source} aria-hidden />
    </span>
  );
}
