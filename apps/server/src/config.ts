import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';

const PositiveNumber = z.coerce.number().positive();

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(4777),
  STALE_AFTER_MIN: PositiveNumber.default(5),
  REMOVE_AFTER_MIN: PositiveNumber.default(10),
  NEEDS_YOU_REMOVE_AFTER_MIN: PositiveNumber.default(60),
  /** How long an agent with a tool still running (no hooks fire meanwhile) is kept. */
  TOOL_STALE_AFTER_MIN: PositiveNumber.default(30),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Where the token lives. */
  AGENT_OFFICE_HOME: z.string().min(1).default(path.join(os.homedir(), '.agent-office')),
  /** Extra browser origin allowed in development (the Vite dev server). */
  AGENT_OFFICE_DEV_ORIGIN: z.url().optional(),
  /** Start the built-in mock generator (pnpm dev:mock). */
  AGENT_OFFICE_MOCK: z
    .enum(['0', '1', 'true', 'false'])
    .default('0')
    .transform((v) => v === '1' || v === 'true'),
});

export interface Config {
  readonly host: '127.0.0.1';
  readonly port: number;
  readonly staleAfterMs: number;
  readonly removeAfterMs: number;
  readonly needsYouRemoveAfterMs: number;
  readonly toolStaleAfterMs: number;
  readonly logLevel: z.infer<typeof EnvSchema>['LOG_LEVEL'];
  readonly homeDir: string;
  /** Origins allowed to open the WebSocket; also the Host values we accept. */
  readonly allowedOrigins: readonly string[];
  readonly mock: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${z.prettifyError(parsed.error)}`);
  }
  const e = parsed.data;
  if (e.REMOVE_AFTER_MIN <= e.STALE_AFTER_MIN) {
    throw new Error('REMOVE_AFTER_MIN must be greater than STALE_AFTER_MIN');
  }
  const own = [`http://127.0.0.1:${e.PORT}`, `http://localhost:${e.PORT}`];
  return {
    host: '127.0.0.1',
    port: e.PORT,
    staleAfterMs: e.STALE_AFTER_MIN * 60_000,
    removeAfterMs: e.REMOVE_AFTER_MIN * 60_000,
    needsYouRemoveAfterMs: e.NEEDS_YOU_REMOVE_AFTER_MIN * 60_000,
    toolStaleAfterMs: e.TOOL_STALE_AFTER_MIN * 60_000,
    logLevel: e.LOG_LEVEL,
    homeDir: e.AGENT_OFFICE_HOME,
    allowedOrigins:
      e.AGENT_OFFICE_DEV_ORIGIN === undefined ? own : [...own, e.AGENT_OFFICE_DEV_ORIGIN],
    mock: e.AGENT_OFFICE_MOCK,
  };
}
