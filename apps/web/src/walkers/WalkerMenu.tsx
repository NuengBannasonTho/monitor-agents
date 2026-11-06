import type { Agent } from '@agent-office/shared';
import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { DesktopWalkersIcon, EditorIcon, HideIcon } from '../components/icons';
import styles from './Walkers.module.css';

export interface MenuAt {
  readonly agent: Agent;
  /** Where you right-clicked, in strip px. */
  readonly x: number;
  readonly y: number;
}

interface WalkerMenuProps extends MenuAt {
  /** Strip size, to keep the menu inside it. */
  readonly width: number;
  readonly height: number;
  readonly onHide: (agent: Agent) => void;
  readonly onOpen: (agent: Agent) => void;
  readonly onHideAll: () => void;
  readonly onClose: () => void;
}

const MENU_WIDTH = 210;
/** Closes this long after the pointer leaves it (clicks elsewhere go to other apps). */
const LEAVE_MS = 400;
/** Closes if never pointed at. */
const IDLE_MS = 5_000;

/**
 * What right-clicking a banana offers: hide this one, open it in the dashboard, or hide them
 * all. Drawn in the strip itself, above where you clicked.
 */
export function WalkerMenu({
  agent,
  x,
  y,
  width,
  height,
  onHide,
  onOpen,
  onHideAll,
  onClose,
}: WalkerMenuProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const later = (ms: number): void => {
    clearTimeout(timer.current);
    timer.current = setTimeout(onClose, ms);
  };
  useEffect(() => {
    timer.current = setTimeout(onClose, IDLE_MS);
    return () => {
      clearTimeout(timer.current);
    };
  }, [onClose]);

  const left = Math.min(Math.max(8, x - MENU_WIDTH / 2), Math.max(8, width - MENU_WIDTH - 8));
  const bottom = Math.min(Math.max(8, height - y + 10), height - 140);

  return (
    <motion.div
      className={styles.menu}
      style={{ left, bottom, width: MENU_WIDTH }}
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.14 }}
      role="menu"
      aria-label={agent.desk}
      data-walker
      onMouseEnter={() => {
        clearTimeout(timer.current);
      }}
      onMouseLeave={() => {
        later(LEAVE_MS);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      <span className={styles.menuTitle}>{agent.desk}</span>
      <button
        type="button"
        role="menuitem"
        className={styles.menuItem}
        onClick={() => {
          onHide(agent);
          onClose();
        }}
      >
        <HideIcon size={15} />
        Hide this banana
      </button>
      <button
        type="button"
        role="menuitem"
        className={styles.menuItem}
        onClick={() => {
          onOpen(agent);
          onClose();
        }}
      >
        <EditorIcon size={15} />
        Open in dashboard
      </button>
      <span className={styles.menuRule} aria-hidden />
      <button
        type="button"
        role="menuitem"
        className={styles.menuItem}
        onClick={() => {
          onHideAll();
          onClose();
        }}
      >
        <DesktopWalkersIcon size={15} />
        Hide all bananas
      </button>
    </motion.div>
  );
}
