import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClaudeCodeAdapter } from './adapters/claude-code.js';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { startMockGenerator } from './mock/generator.js';
import { AgentStore } from './store.js';
import { ensureToken } from './token.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = path.resolve(here, '../../web/dist');

async function main(): Promise<void> {
  const config = loadConfig();
  const token = await ensureToken(config.homeDir);
  const skinsDir = path.join(config.homeDir, 'skins');
  await mkdir(skinsDir, { recursive: true, mode: 0o700 });
  const store = new AgentStore();
  store.startSweeper({
    staleAfterMs: config.staleAfterMs,
    removeAfterMs: config.removeAfterMs,
    needsYouRemoveAfterMs: config.needsYouRemoveAfterMs,
  });

  const app = await buildApp({
    token,
    store,
    adapters: [createClaudeCodeAdapter()],
    allowedOrigins: config.allowedOrigins,
    webDist: WEB_DIST,
    skinsDir,
    logger: { level: config.logLevel },
  });

  await app.fastify.listen({ host: config.host, port: config.port });
  app.fastify.log.info(`Agent Office on http://${config.host}:${config.port}`);

  const stopMock = new AbortController();
  if (config.mock) {
    app.fastify.log.info('mock generator: 6 fake agents across 4 worktrees');
    void startMockGenerator({
      url: `http://${config.host}:${config.port}/events`,
      token,
      signal: stopMock.signal,
      onError: (error) => {
        app.fastify.log.warn({ err: error }, 'mock generator post failed');
      },
    });
  }

  let closing = false;
  const shutdown = (signal: string): void => {
    if (closing) return;
    closing = true;
    app.fastify.log.info(`${signal}: shutting down`);
    stopMock.abort();
    store.dispose();
    app.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  };
  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
