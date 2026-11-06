import { SlidingNumber } from '@animate-ui/react/primitives/texts/sliding-number';
import type { ReactNode, RefObject } from 'react';
import { cx } from '../../lib/cx';
import { CollapseIcon } from '../icons';
import styles from './office.module.css';

interface ZonePanelProps {
  readonly id: string;
  /** Which edge the panel collapses toward. */
  readonly side: 'left' | 'right';
  readonly title: string;
  readonly icon?: ReactNode;
  /** What the panel holds, shown on hover over the title. */
  readonly hint: string;
  /** Per-state chips shown in the title bar. */
  readonly stats?: ReactNode;
  /** Beside the title, before the collapse button (the work-hours clock). */
  readonly aside?: ReactNode;
  readonly count: number;
  /** Agents in here waiting on you; shown in red, even when collapsed. */
  readonly urgent?: number;
  readonly collapsed: boolean;
  /** A panel is opening or shutting: the collapsing scene stays in place while it fades. */
  readonly animating?: boolean;
  readonly onToggle: () => void;
  /** The scene area, measured to place characters. */
  readonly zoneRef: RefObject<HTMLDivElement | null>;
  readonly zoneClassName?: string;
  readonly children?: ReactNode;
}

/** One half of the office: a title bar with a collapse button, and its scene. */
export function ZonePanel({
  id,
  side,
  title,
  icon,
  hint,
  stats,
  aside,
  count,
  urgent = 0,
  collapsed,
  animating = false,
  onToggle,
  zoneRef,
  zoneClassName,
  children,
}: ZonePanelProps) {
  const titleId = `${id}-title`;
  const zoneId = `${id}-zone`;
  const countLabel = urgent > 0 ? `${String(count)}, ${String(urgent)} need you` : String(count);
  return (
    <section
      className={cx(styles.panel, collapsed && styles.collapsed)}
      data-side={side}
      aria-labelledby={titleId}
    >
      <header className={styles.panelHeader}>
        <h2 id={titleId} className={styles.panelTitle} title={hint}>
          <span className={styles.panelIcon}>{icon}</span>
          {title}
          <span
            className={styles.panelCount}
            data-urgent={urgent > 0 ? 'true' : undefined}
            aria-label={countLabel}
          >
            <SlidingNumber number={count} initiallyStable />
          </span>
        </h2>
        {!collapsed && aside !== undefined && <div className={styles.panelAside}>{aside}</div>}
        {!collapsed && <div className={styles.panelStats}>{stats}</div>}
        <button
          type="button"
          className={styles.collapse}
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls={zoneId}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${title}`}
          title={`${collapsed ? 'Expand' : 'Collapse'} ${title}`}
        >
          <CollapseIcon
            size={18}
            className={styles.chevrons}
            data-pointing={collapsed === (side === 'left') ? 'right' : 'left'}
          />
        </button>
      </header>
      <div
        id={zoneId}
        ref={zoneRef}
        className={cx(styles.zone, zoneClassName)}
        hidden={collapsed && !animating}
      >
        {children}
      </div>
    </section>
  );
}
