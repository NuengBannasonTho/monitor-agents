import { existsSync } from 'node:fs';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import { AgentKindSchema } from '@agent-office/shared';
import type { AgentKind, ServerMessage } from '@agent-office/shared';
import Fastify, { LogController } from 'fastify';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import type { WebSocket } from 'ws';
import type { Adapter } from './adapters/types.js';
import { Coalescer } from './coalescer.js';
import { listSkinPacks } from './skins.js';
import type { AgentStore } from './store.js';
import { tokenMatches } from './token.js';

/** Hook payloads can carry large tool_input (e.g. a Write of a whole file). */
const EVENTS_BODY_LIMIT = 4 * 1024 * 1024;

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
      options.store.apply(event);
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
    (socket) => {
      clients.add(socket);
      const snapshot: ServerMessage = { type: 'snapshot', agents: options.store.snapshot() };
      socket.send(JSON.stringify(snapshot));
      socket.on('close', () => {
        clients.delete(socket);
      });
      // The client never needs to talk; ignore anything it sends.
      socket.on('message', () => undefined);
    },
  );

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
    await fastify.register(fastifyStatic, { root: options.webDist, index: 'index.html' });
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
