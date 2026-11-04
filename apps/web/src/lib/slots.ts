/**
 * Stable slot assignment: ids that already hold a slot keep it; new ids take the
 * lowest free slot index. Ids no longer present release their slot.
 * Pure: returns a new Map and never mutates `prev`.
 */
export function assignSlots(
  prev: ReadonlyMap<string, number>,
  ids: readonly string[],
): Map<string, number> {
  const present = new Set(ids);
  const next = new Map<string, number>();
  const taken = new Set<number>();

  for (const [id, slot] of prev) {
    if (present.has(id)) {
      next.set(id, slot);
      taken.add(slot);
    }
  }

  let cursor = 0;
  for (const id of ids) {
    if (next.has(id)) continue;
    while (taken.has(cursor)) cursor++;
    next.set(id, cursor);
    taken.add(cursor);
  }
  return next;
}

/** Content equality for slot maps; lets callers keep the previous instance when nothing changed. */
export function sameAssignment(
  a: ReadonlyMap<string, number>,
  b: ReadonlyMap<string, number>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [id, slot] of a) {
    if (b.get(id) !== slot) return false;
  }
  return true;
}
