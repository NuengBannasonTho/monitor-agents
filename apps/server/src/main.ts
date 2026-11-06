import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClaudeCodeAdapter } from "./adapters/claude-code.js";
import { startCodexSessions } from "./codexSessions.js";
import { buildApp } from "./app.js";
import { userAgentsDir } from "./customAgents.js";
import { orcaAccountReader } from "./orcaAccount.js";
import { orcaLauncher } from "./orcaLauncher.js";
import { codexAssistantPlanner } from "./assistantPlanner.js";
import { orcaSender } from "./orcaTerminal.js";
import { pruneUploads } from "./uploads.js";
import { loadConfig } from "./config.js";
import { startMockGenerator } from "./mock/generator.js";
import { AgentStore } from "./store.js";
import { ensureToken } from "./token.js";
import { UsageIndex, defaultTranscriptRoots } from "./usage/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = path.resolve(here, "../../web/dist");

async function main(): Promise<void> {
  const config = loadConfig();
  const token = await ensureToken(config.homeDir);
  const skinsDir = path.join(config.homeDir, "skins");
  // Files attached in the drawer; a week's worth is kept.
  const uploadsDir = path.join(config.homeDir, "uploads");
  void pruneUploads(uploadsDir);
  await mkdir(skinsDir, { recursive: true, mode: 0o700 });
  const store = new AgentStore();
  store.startSweeper({
    staleAfterMs: config.staleAfterMs,
    removeAfterMs: config.removeAfterMs,
    needsYouRemoveAfterMs: config.needsYouRemoveAfterMs,
    toolStaleAfterMs: config.toolStaleAfterMs,
  });

  // The first read of the transcripts takes a moment: start it now, not on the first visit.
  const usage = config.usage
    ? new UsageIndex({ roots: defaultTranscriptRoots() })
    : null;
  void usage?.refresh();

  const app = await buildApp({
    token,
    store,
    adapters: [createClaudeCodeAdapter(Date.now, { details: config.details })],
    allowedOrigins: config.allowedOrigins,
    webDist: WEB_DIST,
    skinsDir,
    desktopPrefsFile: path.join(config.homeDir, "desktop.json"),
    uploadsDir,
    customAgents: {
      userDir: userAgentsDir(),
      // Deleted agent files go here, not away.
      trashDir: path.join(config.homeDir, "trash", "custom-agents"),
      editable: config.customAgents,
    },
    ...(config.sendToAgents ? { terminalSender: orcaSender() } : {}),
    ...(config.startAgents ? { agentLauncher: orcaLauncher() } : {}),
    ...(config.startAgents
      ? { assistantPlanner: codexAssistantPlanner() }
      : {}),
    accountReader: orcaAccountReader(),
    ...(usage === null ? {} : { usageReader: (range) => usage.report(range) }),
    logger: { level: config.logLevel },
  });

  await app.fastify.listen({ host: config.host, port: config.port });
  app.fastify.log.info(`MON MANG on http://${config.host}:${config.port}`);
  const stopCodexSessions = startCodexSessions(store);

  const stopMock = new AbortController();
  if (config.mock) {
    app.fastify.log.info("mock generator: 6 fake agents across 4 worktrees");
    void startMockGenerator({
      url: `http://${config.host}:${config.port}/events`,
      token,
      signal: stopMock.signal,
      onError: (error) => {
        app.fastify.log.warn({ err: error }, "mock generator post failed");
      },
    });
  }

  let closing = false;
  const shutdown = (signal: string): void => {
    if (closing) return;
    closing = true;
    app.fastify.log.info(`${signal}: shutting down`);
    stopMock.abort();
    stopCodexSessions();
    store.dispose();
    app.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  };
  process.on("SIGINT", () => {
    shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
