import { existsSync } from 'node:fs';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import {
  AgentKindSchema,
  DeleteCustomAgentSchema,
  DesktopPatchSchema,
  SaveCustomAgentSchema,
  SendToAgentSchema,
  NO_ACCOUNT,
  StartTaskSchema,
  UsageRangeSchema,
  TERMINAL_HANDLE_PATTERN,
  leadPrompt,
} from '@agent-office/shared';
import type {
  AccountStatus,
  AgentKind,
  CustomAgentList,
  CustomAgentScope,
  DesktopPrefs,
  DesktopStatus,
  ServerMessage,
  TaskPlaces,
  TeamMember,
  UsageRange,
  UsageReport,
} from '@agent-office/shared';
import Fastify, { LogController } from 'fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest, FastifyServerOptions } from 'fastify';
import type { WebSocket } from 'ws';
import type { Adapter } from './adapters/types.js';
import { Coalescer } from './coalescer.js';
import {
  CustomAgentError,
  agentScopes,
  listCustomAgents,
  saveCustomAgent,
  trashCustomAgent,
} from './customAgents.js';
import { applyDesktopPatch, loadDesktopPrefs, saveDesktopPrefs } from './desktopPrefs.js';
import type { AgentLauncher } from './orcaLauncher.js';
import type { TerminalSender } from './orcaTerminal.js';
import { listSkinPacks } from './skins.js';
import { UploadTooLarge, messageWithFiles, saveUploads } from './uploads.js';
import type { AgentStore } from './store.js';
import { tokenMatches } from './token.js';

/** Hook payloads can carry large tool_input (e.g. a Write of a whole file). */
const EVENTS_BODY_LIMIT = 4 * 1024 * 1024;
/** A message with its attachments, base64-encoded: 10 files of up to 10 MB is the most. */
const SEND_BODY_LIMIT = 140 * 1024 * 1024;

export interface AppOptions {
  readonly token: string;
  readonly store: AgentStore;
  readonly adapters: readonly Adapter[];
  /** Browser origins allowed to open /ws (e.g. http://127.0.0.1:4777). */
  readonly allowedOrigins: readonly string[];
  /** Built web app to serve at "/", if present. */
  readonly webDist?: string;
  /** Folder of skin packs (~/.agent-office/skins). */
  readonly skinsDir?: string;
  /** Where the desktop app choices are kept (~/.agent-office/desktop.json); memory only if unset. */
  readonly desktopPrefsFile?: string;
  /**
   * Types what you write in an agent's drawer into its Orca terminal; absent turns typing off
   * (SEND_TO_AGENTS=off), leaving the dashboard read-only.
   */
  readonly terminalSender?: TerminalSender;
  /** Where files attached in the drawer are saved (~/.agent-office/uploads). */
  readonly uploadsDir?: string;
  /** Starts Claude Code on a task (New task); absent turns that off (START_AGENTS=off). */
  readonly agentLauncher?: AgentLauncher;
  /** The Claude account and its usage, as Orca reports it. */
  readonly accountReader?: () => Promise<AccountStatus>;
  /** Tokens, estimated cost, skills and subagents, from the transcripts; absent with USAGE=off. */
  readonly usageReader?: (range: UsageRange) => Promise<UsageReport>;
  /**
   * Claude Code subagents: yours (userDir) and each working agent's project. Not editable
   * with CUSTOM_AGENTS=off; deleted files are moved to trashDir.
   */
  readonly customAgents?: {
    readonly userDir: string;
    readonly trashDir: string;
    readonly editable: boolean;
  };
  readonly logger?: FastifyServerOptions['logger'];
}

export interface App {
  readonly fastify: FastifyInstance;
  /** Number of connected WebSocket clients (for tests and diagnostics). */
  clientCount(): number;
  close(): Promise<void>;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function statusCodeOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return undefined;
  const code = error.statusCode;
  return typeof code === 'number' && code >= 400 && code < 600 ? code : undefined;
}

function parseJsonSafely(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}

export async function buildApp(options: AppOptions): Promise<App> {
  const fastify = Fastify({
    logger: options.logger ?? false,
    // Hooks fire constantly; per-event debug logs are enough.
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: EVENTS_BODY_LIMIT,
  });

  const allowedOrigins = new Set(options.allowedOrigins);
  // DNS-rebinding guard: only answer requests addressed to our own host names.
  const allowedHosts = new Set(options.allowedOrigins.map((o) => new URL(o).host));
  const adapters = new Map<AgentKind, Adapter>(options.adapters.map((a) => [a.kind, a]));
  const clients = new Set<WebSocket>();

  const broadcast = (message: ServerMessage): void => {
    const data = JSON.stringify(message);
    for (const socket of clients) {
      if (socket.readyState === socket.OPEN) socket.send(data);
    }
  };
  const coalescer = new Coalescer(broadcast);

  // The desktop app (apps/desktop): your choice to show it, and whether it is running.
  let desktopPrefs: DesktopPrefs = loadDesktopPrefs(options.desktopPrefsFile);
  const desktopSockets = new Set<WebSocket>();
  const desktopStatus = (): DesktopStatus => ({
    ...desktopPrefs,
    connected: desktopSockets.size > 0,
  });
  const desktopMessage = (): ServerMessage => ({
    type: 'desktop',
    desktop: desktopStatus(),
  });
  const unsubscribe = options.store.subscribe((change) => {
    coalescer.push(change);
  });

  fastify.addHook('onRequest', async (request, reply) => {
    const host = headerValue(request.headers.host);
    if (host === undefined || !allowedHosts.has(host)) {
      request.log.debug({ host }, 'rejected request for unexpected host');
      return reply.code(421).send();
    }
  });

  // Never let a malformed body turn into an error response for hooks: parse leniently.
  fastify.removeAllContentTypeParsers();
  fastify.addContentTypeParser('*', { parseAs: 'string' }, (_request, body, done) => {
    done(null, typeof body === 'string' ? parseJsonSafely(body) : undefined);
  });

  fastify.setErrorHandler(async (error, request, reply) => {
    const message = error instanceof Error ? error.message : String(error);
    if (request.url.startsWith('/events')) {
      request.log.debug({ err: message }, 'dropped /events payload');
      return reply.code(204).send();
    }
    request.log.error({ err: message }, 'request failed');
    return reply.code(statusCodeOf(error) ?? 500).send({ error: 'request failed' });
  });

  fastify.post('/events', async (request, reply) => {
    if (!tokenMatches(options.token, headerValue(request.headers['x-token']))) {
      return reply.code(401).send();
    }
    const kindHeader = headerValue(request.headers['x-agent-kind']) ?? 'claude-code';
    const kind = AgentKindSchema.safeParse(kindHeader);
    const adapter = kind.success ? adapters.get(kind.data) : undefined;
    const event = adapter?.normalize(request.body) ?? null;
    if (event === null) {
      request.log.debug({ kind: kindHeader }, 'dropped unknown or malformed event');
    } else {
      request.log.debug({ type: event.type, session: event.sessionId }, 'event');
      // Inside Orca, the hook says which terminal the agent runs in (emit.sh).
      const terminal = headerValue(request.headers['x-orca-terminal']);
      options.store.apply(
        terminal !== undefined && TERMINAL_HANDLE_PATTERN.test(terminal)
          ? { ...event, terminal }
          : event,
      );
    }
    return reply.code(204).send();
  });

  fastify.get('/healthz', () => ({ ok: true }));

  await fastify.register(fastifyWebsocket, { options: { maxPayload: 1024 } });
  fastify.get(
    '/ws',
    {
      websocket: true,
      // Cross-site WebSocket hijacking guard: browsers always send Origin.
      preValidation: async (request, reply) => {
        const origin = headerValue(request.headers.origin);
        if (origin === undefined || !allowedOrigins.has(origin)) {
          request.log.debug({ origin }, 'rejected websocket origin');
          return reply.code(403).send();
        }
      },
    },
    (socket, request) => {
      clients.add(socket);
      const snapshot: ServerMessage = {
        type: 'snapshot',
        agents: options.store.snapshot(),
      };
      socket.send(JSON.stringify(snapshot));
      // The desktop app's page says so, so the dashboard can tell it is running.
      const query = request.query as Record<string, unknown> | undefined;
      const isDesktop = query?.client === 'desktop';
      if (isDesktop) {
        desktopSockets.add(socket);
        broadcast(desktopMessage());
      } else {
        socket.send(JSON.stringify(desktopMessage()));
      }
      socket.on('close', () => {
        clients.delete(socket);
        if (desktopSockets.delete(socket)) broadcast(desktopMessage());
      });
      // The client never needs to talk; ignore anything it sends.
      socket.on('message', () => undefined);
    },
  );

  fastify.get('/api/desktop', () => desktopStatus());
  fastify.put('/api/desktop', async (request, reply) => {
    // Cross-site request guard: a browser always says where it comes from.
    const origin = headerValue(request.headers.origin);
    if (origin !== undefined && !allowedOrigins.has(origin)) return reply.code(403).send();
    const parsed = DesktopPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'expected { walkers?: boolean, agent?: { id, hidden: boolean } }',
      });
    }
    desktopPrefs = applyDesktopPatch(desktopPrefs, parsed.data);
    await saveDesktopPrefs(options.desktopPrefsFile, desktopPrefs);
    broadcast(desktopMessage());
    return desktopStatus();
  });

  /**
   * The Orca terminal of a Claude Code agent you may type to from this dashboard, once Orca
   * confirms it is still running Claude Code; otherwise the refusal has been sent.
   */
  const typeableTerminal = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<{
    handle: string;
    sender: TerminalSender;
    agentId: string;
  } | null> => {
    const origin = headerValue(request.headers.origin);
    if (origin !== undefined && !allowedOrigins.has(origin)) {
      await reply.code(403).send();
      return null;
    }
    const sender = options.terminalSender;
    if (sender === undefined) {
      await reply.code(403).send({ error: 'Typing to agents is off (SEND_TO_AGENTS=off).' });
      return null;
    }
    const agent = options.store.get(request.params.id);
    if (agent === undefined) {
      await reply.code(404).send({ error: 'That agent is gone.' });
      return null;
    }
    if (agent.kind !== 'claude-code' || agent.terminal === undefined) {
      await reply.code(409).send({
        error: 'This agent is not running in Orca: use its own terminal.',
      });
      return null;
    }
    const check = await sender.check(agent.terminal);
    if (!check.ok) {
      const why = {
        gone: 'Its Orca terminal is closed.',
        'not-claude': 'Claude Code is no longer running in its terminal.',
        unavailable: 'Orca is not reachable (is the Orca app open?).',
      }[check.reason];
      await reply.code(409).send({ error: why });
      return null;
    }
    return { handle: agent.terminal, sender, agentId: agent.id };
  };

  /**
   * Types a message to an agent, as if you typed it in its Orca terminal. Attached files are
   * saved first (outside your projects) and the message points the agent at them with @path.
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/agents/:id/send',
    { bodyLimit: SEND_BODY_LIMIT },
    async (request, reply) => {
      const parsed = SendToAgentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Write something or attach a file to send.' });
      }
      const target = await typeableTerminal(request, reply);
      if (target === null) return reply;
      let paths: string[] = [];
      if (parsed.data.files.length > 0) {
        if (options.uploadsDir === undefined) {
          return reply.code(403).send({ error: 'Attachments are not set up on this server.' });
        }
        try {
          paths = await saveUploads(options.uploadsDir, target.agentId, parsed.data.files);
        } catch (error) {
          return reply.code(error instanceof UploadTooLarge ? 413 : 500).send({
            error:
              error instanceof UploadTooLarge
                ? 'A file is empty or over 10 MB.'
                : 'Could not save the attachments.',
          });
        }
      }
      const sent = await target.sender.send(
        target.handle,
        messageWithFiles(parsed.data.text, paths),
      );
      request.log.info(
        { session: target.agentId },
        sent ? 'typed to agent' : 'typing to agent failed',
      );
      return sent
        ? { ok: true, files: paths.length }
        : reply.code(502).send({ error: 'Orca did not take the message.' });
    },
  );

  /** Stops what an agent is doing, as pressing Esc in its terminal does; the session stays. */
  fastify.post<{ Params: { id: string } }>('/api/agents/:id/interrupt', async (request, reply) => {
    const target = await typeableTerminal(request, reply);
    if (target === null) return reply;
    const stopped = await target.sender.interrupt(target.handle);
    if (stopped) {
      const agent = options.store.get(target.agentId);
      if (agent !== undefined) {
        options.store.apply({
          sessionId: agent.id,
          kind: agent.kind,
          cwd: agent.cwd,
          type: 'interrupt',
          summary: 'Stopped from the dashboard',
          at: Date.now(),
        });
      }
    }
    request.log.info(
      { session: target.agentId },
      stopped ? 'stopped agent' : 'stopping agent failed',
    );
    return stopped ? { ok: true } : reply.code(502).send({ error: 'Orca did not take the Esc.' });
  });

  const customAgents = options.customAgents;
  /** Yours, plus the project folder of every agent here now. */
  const agentFolders = async (): Promise<CustomAgentScope[]> =>
    customAgents === undefined
      ? []
      : agentScopes(
          customAgents.userDir,
          options.store.snapshot().map((a) => a.cwd),
        );

  fastify.get('/api/custom-agents', async (): Promise<CustomAgentList> => {
    const scopes = await agentFolders();
    return {
      editable: customAgents?.editable ?? false,
      scopes,
      agents: await listCustomAgents(scopes),
    };
  });

  /** The folder a change goes to, once the change is allowed; otherwise the refusal is sent. */
  const writableFolder = async (
    request: FastifyRequest,
    reply: FastifyReply,
    scopeId: string,
  ): Promise<CustomAgentScope | null> => {
    const origin = headerValue(request.headers.origin);
    if (origin !== undefined && !allowedOrigins.has(origin)) {
      await reply.code(403).send();
      return null;
    }
    if (customAgents?.editable !== true) {
      await reply.code(403).send({ error: 'Editing custom agents is off (CUSTOM_AGENTS=off).' });
      return null;
    }
    const scope = (await agentFolders()).find((s) => s.id === scopeId);
    if (scope === undefined) {
      await reply.code(404).send({
        error: 'That folder is not known here any more (its agent may have left).',
      });
      return null;
    }
    return scope;
  };

  const customAgentFailure = (error: unknown, reply: FastifyReply): FastifyReply => {
    if (error instanceof CustomAgentError)
      return reply.code(error.status).send({ error: error.message });
    throw error;
  };

  /** Creates an agent file (no file given) or updates one. */
  fastify.post('/api/custom-agents', async (request, reply) => {
    const parsed = SaveCustomAgentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: parsed.error.issues[0]?.message ?? 'That agent is not valid.',
      });
    }
    const { scope: scopeId, file, modifiedAt, agent } = parsed.data;
    const scope = await writableFolder(request, reply, scopeId);
    if (scope === null) return reply;
    try {
      const saved = await saveCustomAgent(
        scope,
        agent,
        file === undefined ? undefined : modifiedAt === undefined ? { file } : { file, modifiedAt },
      );
      request.log.info(
        { file: saved.path },
        file === undefined ? 'created agent file' : 'saved agent file',
      );
      return await reply.code(file === undefined ? 201 : 200).send({ agent: saved });
    } catch (error) {
      return customAgentFailure(error, reply);
    }
  });

  /** Moves an agent file to the trash (~/.agent-office/trash), so it can be brought back. */
  fastify.delete('/api/custom-agents', async (request, reply) => {
    const parsed = DeleteCustomAgentSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Which agent file?' });
    const scope = await writableFolder(request, reply, parsed.data.scope);
    if (scope === null || customAgents === undefined) return reply;
    try {
      const trashedTo = await trashCustomAgent(scope, parsed.data.file, customAgents.trashDir);
      request.log.info({ trashedTo }, 'moved agent file to the trash');
      return { ok: true, trashedTo };
    } catch (error) {
      return customAgentFailure(error, reply);
    }
  });

  /** Which Claude account the agents run on, and how much of its usage is left. */
  fastify.get('/api/account', async (): Promise<AccountStatus> =>
    options.accountReader === undefined ? NO_ACCOUNT : options.accountReader(),
  );

  /** What the agents used: tokens, estimated cost, context, skills, subagents and tools. */
  fastify.get('/api/usage', async (request, reply) => {
    const reader = options.usageReader;
    if (reader === undefined) {
      return reply.code(403).send({ error: 'The usage page is off (USAGE=off).' });
    }
    const query = request.query as Record<string, unknown> | undefined;
    const range = UsageRangeSchema.safeParse(query?.range ?? 'today');
    if (!range.success) return reply.code(400).send({ error: 'range is today, 7d or 30d' });
    return reader(range.data);
  });

  /** Where a task can run: Orca's repos and worktrees. */
  fastify.get('/api/tasks/places', async (): Promise<TaskPlaces> => {
    const launcher = options.agentLauncher;
    const places = launcher === undefined ? null : await launcher.places();
    return {
      enabled: launcher !== undefined,
      reachable: places !== null,
      repos: [...(places?.repos ?? [])],
      worktrees: [...(places?.worktrees ?? [])],
    };
  });

  /**
   * Starts Claude Code on your task, in a new worktree or an existing one, with your team of
   * custom agents named in its first prompt. It then shows up like any other agent.
   */
  fastify.post('/api/tasks', async (request, reply) => {
    const origin = headerValue(request.headers.origin);
    if (origin !== undefined && !allowedOrigins.has(origin)) return reply.code(403).send();
    const launcher = options.agentLauncher;
    if (launcher === undefined) {
      return reply.code(403).send({ error: 'Starting agents is off (START_AGENTS=off).' });
    }
    const parsed = StartTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: parsed.error.issues[0]?.message ?? 'That task is not valid.',
      });
    }
    const { task, where, team } = parsed.data;

    // Only places Orca listed: the ids never reach Orca unchecked.
    const places = await launcher.places();
    if (places === null) {
      return reply.code(502).send({ error: 'Orca is not reachable (is the Orca app open?).' });
    }
    const repo = where.kind === 'new' ? places.repos.find((r) => r.id === where.repoId) : undefined;
    const worktree =
      where.kind === 'existing'
        ? places.worktrees.find((w) => w.id === where.worktreeId)
        : undefined;
    const projectDir = repo?.path ?? worktree?.path;
    if (projectDir === undefined) {
      return reply.code(404).send({ error: 'Orca does not have that place any more.' });
    }

    // The team, as the lead will be told about it: yours, or this project's.
    let members: TeamMember[] = [];
    if (team.length > 0) {
      const known =
        customAgents === undefined
          ? []
          : await listCustomAgents(await agentScopes(customAgents.userDir, [projectDir]));
      const missing = team.filter((name) => !known.some((a) => a.name === name));
      if (missing.length > 0) {
        return reply.code(400).send({
          error: `No custom agent named ${missing.join(', ')} for that project.`,
        });
      }
      members = team.map((name) => {
        const agent = known.find((a) => a.name === name);
        return { name, description: agent?.description ?? '' };
      });
    }

    const prompt = leadPrompt(task, members);
    const started =
      where.kind === 'new'
        ? await launcher.startInNewWorktree(where.repoId, where.name, prompt)
        : await launcher.startInWorktree(where.worktreeId, prompt);
    request.log.info(
      {
        where: where.kind === 'new' ? `${projectDir} → ${where.name}` : projectDir,
        team,
      },
      started.ok ? 'started an agent' : 'starting an agent failed',
    );
    return started.ok
      ? reply.code(201).send({
          ok: true,
          where: where.kind === 'new' ? where.name : worktree?.name,
        })
      : reply.code(502).send({ error: started.error });
  });

  const skinsDir = options.skinsDir;
  fastify.get('/api/skins', async (request) => ({
    packs:
      skinsDir === undefined
        ? []
        : await listSkinPacks(skinsDir, (id, reason) => {
            request.log.warn({ pack: id, reason }, 'skipping invalid skin pack');
          }),
  }));
  if (skinsDir !== undefined && existsSync(skinsDir)) {
    await fastify.register(fastifyStatic, {
      root: skinsDir,
      prefix: '/skins/',
      decorateReply: false,
      index: false,
      list: false,
      dotfiles: 'deny',
      // Only sprites; manifests go through /api/skins after validation.
      allowedPath: (pathName) => /^\/[a-z0-9-]+\/[a-z0-9-]+\.png$/.test(pathName),
      maxAge: '5m',
    });
  }

  if (options.webDist !== undefined && existsSync(options.webDist)) {
    await fastify.register(fastifyStatic, {
      root: options.webDist,
      index: 'index.html',
    });
  }

  return {
    fastify,
    clientCount: () => clients.size,
    close: async () => {
      unsubscribe();
      coalescer.dispose();
      for (const socket of clients) socket.close(1001, 'server shutting down');
      await fastify.close();
    },
  };
}
