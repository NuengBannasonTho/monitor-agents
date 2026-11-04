import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ServerMessageSchema } from '@agent-office/shared';
import type { ServerMessage } from '@agent-office/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClaudeCodeAdapter } from './adapters/claude-code.js';
import type { App } from './app.js';
import { buildApp } from './app.js';
import { AgentStore } from './store.js';
import { ensureToken, tokenMatches } from './token.js';

const TOKEN = 'a'.repeat(64);
const HOST = '127.0.0.1:4777';
const ORIGIN = `http://${HOST}`;

let app: App;
let store: AgentStore;

beforeEach(async () => {
  store = new AgentStore();
  app = await buildApp({
    token: TOKEN,
    store,
    adapters: [createClaudeCodeAdapter()],
    allowedOrigins: [ORIGIN],
  });
  await app.fastify.ready();
});
afterEach(async () => {
  store.dispose();
  await app.close();
});

function postEvent(body: unknown, headers: Record<string, string> = {}) {
  return app.fastify.inject({
    method: 'POST',
    url: '/events',
    headers: { host: HOST, 'content-type': 'application/json', 'x-token': TOKEN, ...headers },
    payload: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const start = {
  session_id: 's1',
  cwd: '/w/feat-auth',
  hook_event_name: 'SessionStart',
  source: 'startup',
};

describe('POST /events', () => {
  it('rejects a missing or wrong token with 401', async () => {
    expect((await postEvent(start, { 'x-token': '' })).statusCode).toBe(401);
    expect((await postEvent(start, { 'x-token': 'b'.repeat(64) })).statusCode).toBe(401);
    expect(store.snapshot()).toHaveLength(0);
  });

  it('accepts a valid hook with 204 and updates the store', async () => {
    const res = await postEvent(start);
    expect(res.statusCode).toBe(204);
    expect(store.get('s1')?.desk).toBe('feat-auth');
  });

  it.each([
    ['invalid JSON', '{nope'],
    ['empty body', ''],
    ['unknown event', { ...start, hook_event_name: 'PostToolUse' }],
    ['wrong shape', [1, 2, 3]],
  ])('drops %s with 204', async (_label, body) => {
    expect((await postEvent(body)).statusCode).toBe(204);
    expect(store.snapshot()).toHaveLength(0);
  });

  it('accepts a body sent without a JSON content type (plain curl -d)', async () => {
    const res = await postEvent(start, { 'content-type': 'application/x-www-form-urlencoded' });
    expect(res.statusCode).toBe(204);
    expect(store.get('s1')).toBeDefined();
  });

  it('drops events for an unknown agent kind', async () => {
    expect((await postEvent(start, { 'x-agent-kind': 'nope' })).statusCode).toBe(204);
    expect(store.snapshot()).toHaveLength(0);
  });

  it('refuses requests for a foreign Host (DNS rebinding)', async () => {
    expect((await postEvent(start, { host: 'evil.test:4777' })).statusCode).toBe(421);
  });
});

describe('WebSocket /ws', () => {
  it('rejects a foreign Origin', async () => {
    await expect(
      app.fastify.injectWS('/ws', { headers: { host: HOST, origin: 'https://evil.test' } }),
    ).rejects.toThrow();
    await expect(app.fastify.injectWS('/ws', { headers: { host: HOST } })).rejects.toThrow();
    expect(app.clientCount()).toBe(0);
  });

  it('sends a snapshot on connect, then deltas', async () => {
    await postEvent(start);
    const messages: ServerMessage[] = [];
    let resolveTwo: () => void = () => undefined;
    const two = new Promise<void>((resolve) => {
      resolveTwo = resolve;
    });
    // Listen from onInit: the snapshot is sent as soon as the socket opens.
    const ws = await app.fastify.injectWS(
      '/ws',
      { headers: { host: HOST, origin: ORIGIN } },
      {
        onInit: (socket) => {
          socket.on('message', (data: Buffer) => {
            messages.push(ServerMessageSchema.parse(JSON.parse(data.toString())));
            if (messages.length === 2) resolveTwo();
          });
        },
      },
    );
    await postEvent({ ...start, hook_event_name: 'UserPromptSubmit', prompt: 'hidden' });
    await two;
    ws.terminate();

    expect(messages[0]).toMatchObject({ type: 'snapshot', agents: [{ id: 's1', state: 'idle' }] });
    expect(messages[1]).toMatchObject({ type: 'upsert', agent: { id: 's1', state: 'called' } });
    expect(JSON.stringify(messages)).not.toContain('hidden');
  });
});

describe('token file', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'agent-office-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('creates a 0600 token once and reuses it', async () => {
    const first = await ensureToken(dir);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect((await stat(path.join(dir, 'token'))).mode & 0o777).toBe(0o600);
    expect(await ensureToken(dir)).toBe(first);
    const headers = await readFile(path.join(dir, 'curl-headers'), 'utf8');
    expect(headers).toBe(`X-Token: ${first}\n`);
    expect((await stat(path.join(dir, 'curl-headers'))).mode & 0o777).toBe(0o600);
  });

  it('compares tokens exactly', () => {
    expect(tokenMatches('abc', 'abc')).toBe(true);
    expect(tokenMatches('abc', 'abd')).toBe(false);
    expect(tokenMatches('abc', 'ab')).toBe(false);
    expect(tokenMatches('abc', undefined)).toBe(false);
  });
});
