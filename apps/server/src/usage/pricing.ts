/*
 * Anthropic API list prices, US$ per million tokens, to put a price on what the transcripts
 * record. On a Claude plan you do not pay per token; this is what the same use would cost
 * on the API. Cache writes cost 1.25x input for the 5-minute cache and 2x for the 1-hour
 * one; cache reads have their own rate per model. Checked against the costUSD Claude Code
 * itself writes into its transcripts (cost-state lines).
 */

export interface Rates {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
}

/** Longest prefix wins, so claude-opus-5-5 is not priced as claude-opus-5. */
const RATES: readonly (readonly [prefix: string, rates: Rates])[] = [
  ['claude-fable-5-1', { input: 10, output: 50, cacheRead: 0.25 }],
  ['claude-mythos-5-1', { input: 10, output: 50, cacheRead: 0.25 }],
  ['claude-fable-5', { input: 10, output: 50, cacheRead: 1 }],
  ['claude-mythos-5', { input: 10, output: 50, cacheRead: 1 }],
  ['claude-opus-5-5', { input: 4, output: 20, cacheRead: 0.2 }],
  ['claude-opus-5', { input: 5, output: 25, cacheRead: 0.5 }],
  ['claude-opus-4-8', { input: 5, output: 25, cacheRead: 0.5 }],
  ['claude-opus-4-7', { input: 5, output: 25, cacheRead: 0.5 }],
  ['claude-opus-4-6', { input: 5, output: 25, cacheRead: 0.5 }],
  ['claude-opus-4-5', { input: 5, output: 25, cacheRead: 0.5 }],
  ['claude-opus-4', { input: 15, output: 75, cacheRead: 1.5 }],
  ['claude-sonnet-5', { input: 2, output: 10, cacheRead: 0.2 }],
  ['claude-sonnet-4', { input: 3, output: 15, cacheRead: 0.3 }],
  ['claude-3-7-sonnet', { input: 3, output: 15, cacheRead: 0.3 }],
  ['claude-haiku-5-5', { input: 0.1, output: 0.5, cacheRead: 0.01 }],
  ['claude-haiku-4-5', { input: 1, output: 5, cacheRead: 0.1 }],
  ['claude-3-5-haiku', { input: 0.8, output: 4, cacheRead: 0.08 }],
];

/** Claude Haiku 5.5 costs more past this many prompt tokens. */
const HAIKU_LONG_PROMPT = 100_000;
const HAIKU_LONG: Rates = { input: 0.5, output: 2.5, cacheRead: 0.05 };

/** claude-opus-5-5[1m], us.anthropic.claude-opus-5-5, claude-haiku-4-5-20251001 → the bare id. */
export function baseModel(model: string): string {
  return model
    .toLowerCase()
    .replace(/\[.*\]$/, '')
    .replace(/^(?:[a-z]{2,4}\.)?anthropic\./, '')
    .replace(/@.*$/, '')
    .replace(/-\d{8}$/, '');
}

export function ratesFor(model: string): Rates | null {
  const id = baseModel(model);
  let best: Rates | null = null;
  let bestLength = 0;
  for (const [prefix, rates] of RATES) {
    if (prefix.length > bestLength && (id === prefix || id.startsWith(`${prefix}-`))) {
      best = rates;
      bestLength = prefix.length;
    }
  }
  return best;
}

/** One request's tokens, cache writes split by how long they are kept. */
export interface RequestTokens {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheWrite5m: number;
  readonly cacheWrite1h: number;
}

export interface Priced {
  /** null when the model has no known price. */
  readonly costUsd: number | null;
  /** The same request with nothing cached: every prompt token at the input rate. */
  readonly uncachedUsd: number | null;
}

/** Fast mode bills the same tokens at twice the rate. */
export function priceRequest(model: string, t: RequestTokens, speed?: string): Priced {
  let rates = ratesFor(model);
  if (rates === null) return { costUsd: null, uncachedUsd: null };
  const prompt = t.input + t.cacheRead + t.cacheWrite5m + t.cacheWrite1h;
  if (baseModel(model).startsWith('claude-haiku-5-5') && prompt > HAIKU_LONG_PROMPT) {
    rates = HAIKU_LONG;
  }
  const speedFactor = speed === 'fast' ? 2 : 1;
  const perToken = (perMillion: number) => (perMillion * speedFactor) / 1_000_000;
  const costUsd =
    t.input * perToken(rates.input) +
    t.cacheWrite5m * perToken(rates.input * 1.25) +
    t.cacheWrite1h * perToken(rates.input * 2) +
    t.cacheRead * perToken(rates.cacheRead) +
    t.output * perToken(rates.output);
  const uncachedUsd = prompt * perToken(rates.input) + t.output * perToken(rates.output);
  return { costUsd, uncachedUsd };
}

/**
 * How many tokens the model's context holds. Claude 4.6 and later, and every Claude 5,
 * have 1M; older ones 200K.
 */
export function contextWindowFor(model: string | null): number {
  if (model === null) return 1_000_000;
  const id = baseModel(model);
  const old =
    /^claude-(?:opus|sonnet)-4(?:-[0-5])?$/.test(id) ||
    id.startsWith('claude-haiku-4') ||
    id.startsWith('claude-3');
  return old ? 200_000 : 1_000_000;
}
