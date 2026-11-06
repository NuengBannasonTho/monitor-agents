const REDACTED = '[REDACTED]';

/**
 * Ordered so the specific token shapes run before the generic `name=value` rule.
 * Patterns are deliberately broad: a false positive costs a word in an activity
 * line; a false negative leaks a credential into the UI.
 */
const TOKEN_RULES: readonly (readonly [RegExp, string])[] = [
  // Known token prefixes.
  [/\bsk-[A-Za-z0-9_-]{6,}/g, REDACTED], // OpenAI / Anthropic style (sk-, sk-ant-, sk-proj-)
  [/\bgh[pousr]_[A-Za-z0-9]{10,}/g, REDACTED], // GitHub tokens
  [/\bgithub_pat_[A-Za-z0-9_]{10,}/g, REDACTED],
  [/\bxox[abprs]-[A-Za-z0-9-]{6,}/g, REDACTED], // Slack
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, REDACTED], // AWS access key ids
  // Authorization headers and URL credentials.
  [/\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, `$1 ${REDACTED}`],
  [/(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)[^\s@/]+@/gi, `$1${REDACTED}@`],
];

const RULES: readonly (readonly [RegExp, string])[] = [
  ...TOKEN_RULES,
  // name=value / name: value where the name mentions a secret.
  [
    /(\b[A-Za-z0-9_.-]*(?:key|secret|token|passwd|password|pwd|credential)[A-Za-z0-9_.-]*\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s&;|,]+)/gi,
    `$1${REDACTED}`,
  ],
  // --password value / -p value style flags.
  [/(--?(?:password|passwd|token|secret|api-key|apikey|key)[\s=]+)(\S+)/gi, `$1${REDACTED}`],
];

function apply(rules: readonly (readonly [RegExp, string])[], text: string): string {
  let out = text;
  for (const [pattern, replacement] of rules) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function redactSecrets(text: string): string {
  return apply(RULES, text);
}

/**
 * Only the unmistakable shapes (API tokens, auth headers, URL passwords), for source code:
 * the `name = value` rule would blank out ordinary lines like `key={item.id}` in a diff.
 */
export function redactTokens(text: string): string {
  return apply(TOKEN_RULES, text);
}

/** Truncates to `max` characters (by code point), appending an ellipsis when cut. */
export function truncate(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return `${chars.slice(0, Math.max(0, max - 1)).join('')}…`;
}

/** Collapses newlines/tabs so multi-line commands fit in one activity line. */
export function singleLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
