/** Joins class names, skipping falsy entries (CSS-module lookups may be undefined). */
export function cx(...classes: readonly (string | false | null | undefined)[]): string {
  return classes.filter((c): c is string => typeof c === 'string' && c.length > 0).join(' ');
}
