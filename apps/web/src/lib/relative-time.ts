const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Compact relative time: "just now", "12s ago", "4m ago", "2h ago", "3d ago". */
export function formatRelative(at: number, now: number): string {
  const diff = Math.max(0, now - at);
  if (diff < 5 * SECOND) return 'just now';
  if (diff < MINUTE) return `${Math.floor(diff / SECOND)}s ago`;
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  return `${Math.floor(diff / DAY)}d ago`;
}

/** Absolute local time for tooltips, e.g. "14:03:27". */
export function formatClock(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
