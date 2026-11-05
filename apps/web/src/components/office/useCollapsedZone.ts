import type { Zone } from '@agent-office/shared';
import { useCallback, useState } from 'react';

const STORAGE_KEY = 'agent-office:collapsed-zone:v1';

function read(): Zone | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'lounge' || value === 'table' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Which panel is collapsed, remembered in this browser. At most one: collapsing a panel
 * gives the whole width to the other.
 */
export function useCollapsedZone(): readonly [Zone | null, (zone: Zone | null) => void] {
  const [collapsed, setState] = useState(read);
  const setCollapsed = useCallback((zone: Zone | null) => {
    setState(zone);
    try {
      window.localStorage.setItem(STORAGE_KEY, zone ?? '');
    } catch {
      // Storage unavailable: the panel still collapses for this tab.
    }
  }, []);
  return [collapsed, setCollapsed];
}
