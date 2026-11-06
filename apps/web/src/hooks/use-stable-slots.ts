import { useState } from 'react';
import { assignSlots, sameAssignment } from '../lib/slots';

/**
 * Keeps slot assignments stable across renders. Uses React's "adjust state while
 * rendering" pattern (https://react.dev/reference/react/useState#storing-information-from-previous-renders)
 * instead of an effect, so the first paint already has correct seats.
 */
export function useStableSlots(ids: readonly string[]): ReadonlyMap<string, number> {
  const [assignment, setAssignment] = useState<ReadonlyMap<string, number>>(() => new Map());
  const next = assignSlots(assignment, ids);
  if (sameAssignment(next, assignment)) {
    return assignment;
  }
  setAssignment(next);
  return next;
}
