/** US dollars at a useful precision: "$0", "<$0.01", "$0.42", "$12.30", "$1,284". */
export function formatUsd(value: number): string {
  if (value <= 0) return '$0';
  if (value < 0.01) return '<$0.01';
  if (value >= 1000) return `$${Math.round(value).toLocaleString('en-US')}`;
  return `$${value.toFixed(2)}`;
}

/** Token counts, compact past a thousand: "940", "12.9K", "4.2M", "1.3B". */
export function formatTokens(value: number): string {
  const n = Math.max(0, value);
  const units: readonly [number, string][] = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [size, unit] of units) {
    if (n >= size) {
      const scaled = n / size;
      return `${scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, '')}${unit}`;
    }
  }
  return String(Math.round(n));
}

/** A share of a whole: "0%", "<1%", "37%". */
export function formatShare(part: number, whole: number): string {
  if (whole <= 0 || part <= 0) return '0%';
  const percent = (part / whole) * 100;
  return percent < 1 ? '<1%' : `${String(Math.round(percent))}%`;
}

/** "Nov 6" from a local YYYY-MM-DD. */
export function formatDay(day: string, options: Intl.DateTimeFormatOptions = {}): string {
  const [y, m, d] = day.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) return day;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

/** "1 session", "3 sessions", "1,284 requests". */
export function plural(count: number, word: string): string {
  return `${count.toLocaleString('en-US')} ${word}${count === 1 ? '' : 's'}`;
}
