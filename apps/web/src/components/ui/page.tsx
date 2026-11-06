import type { ReactNode } from 'react';
import { Fragment } from 'react';
import { APP_NAME } from '../../lib/brand';
import styles from './page.module.css';

interface PageProps {
  /** Where this page sits, after the app's name: ["Agents"], ["Settings", "Desktop"]. */
  readonly trail: readonly string[];
  /** A large title over the content; the office goes without one. */
  readonly title?: string;
  readonly subtitle?: ReactNode;
  /** Buttons on the right of the top bar. */
  readonly actions?: ReactNode;
  /** The content fills the rest of the screen edge to edge (the office's two scenes). */
  readonly fill?: boolean;
  readonly children: ReactNode;
}

/**
 * Every page beside the sidebar: a top bar as tall as the sidebar's brand row (their hairlines
 * meet in one line across the screen) with the breadcrumb and the page's buttons, then the
 * title and the content, always the full width.
 */
export function Page({ trail, title, subtitle, actions, fill = false, children }: PageProps): React.JSX.Element {
  const crumbs = [APP_NAME, ...trail];
  return (
    <div className={styles.page} data-fill={fill || undefined}>
      <header className={styles.bar}>
        <nav className={styles.trail} aria-label="Breadcrumb">
          {crumbs.map((crumb, i) => (
            <Fragment key={`${String(i)}-${crumb}`}>
              {i > 0 && (
                <span className={styles.separator} aria-hidden>
                  /
                </span>
              )}
              <span
                className={styles.crumb}
                aria-current={i === crumbs.length - 1 ? 'page' : undefined}
              >
                {crumb}
              </span>
            </Fragment>
          ))}
        </nav>
        {actions !== undefined && <div className={styles.actions}>{actions}</div>}
      </header>
      <div className={styles.body}>
        {title !== undefined && (
          <div className={styles.titles}>
            <h1 className={styles.title}>{title}</h1>
            {subtitle !== undefined && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
