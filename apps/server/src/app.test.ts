import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ServerMessageSchema } from '@agent-office/shared';
import type { ServerMessage } from '@agent-office/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClaudeCodeAdapter } from './adapters/claude-code.js';
import type { App } from './app.js';
import { buildApp } from './app.js';
import { loadDesktopPrefs } from './desktopPrefs.js';
import type { AgentLauncher, Places } from './orcaLauncher.js';
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
    adapters: [createClaudeCodeAdapter(Date.now, { details: false })],
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
    headers: {
      host: HOST,
      'content-type': 'application/json',
      'x-token': TOKEN,
      ...headers,
    },
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
    const res = await postEvent(start, {
      'content-type': 'application/x-www-form-urlencoded',
    });
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
      app.fastify.injectWS('/ws', {
        headers: { host: HOST, origin: 'https://evil.test' },
      }),
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
            const message = ServerMessageSchema.parse(JSON.parse(data.toString()));
            // The desktop app's status follows the snapshot; this test is about agents.
            if (message.type === 'desktop') return;
            messages.push(message);
            if (messages.length === 2) resolveTwo();
          });
        },
      },
    );
    await postEvent({
      ...start,
      hook_event_name: 'UserPromptSubmit',
      prompt: 'hidden',
    });
    await two;
    ws.terminate();

    expect(messages[0]).toMatchObject({
      type: 'snapshot',
      agents: [{ id: 's1', state: 'idle' }],
    });
    expect(messages[1]).toMatchObject({
      type: 'upsert',
      agent: { id: 's1', state: 'called' },
    });
    expect(JSON.stringify(messages)).not.toContain('hidden');
  });
});

describe('desktop app setting', () => {
  let dir: string;
  let file: string;
  let desktopApp: App;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'agent-office-'));
    file = path.join(dir, 'desktop.json');
    desktopApp = await buildApp({
      token: TOKEN,
      store,
      adapters: [],
      allowedOrigins: [ORIGIN],
      desktopPrefsFile: file,
    });
    await desktopApp.fastify.ready();
  });
  afterEach(async () => {
    await desktopApp.close();
    await rm(dir, { recursive: true, force: true });
  });

  const put = (body: unknown, origin = ORIGIN) =>
    desktopApp.fastify.inject({
      method: 'PUT',
      url: '/api/desktop',
      headers: { host: HOST, origin, 'content-type': 'application/json' },
      payload: JSON.stringify(body),
    });
  const get = async () =>
    (
      await desktopApp.fastify.inject({
        url: '/api/desktop',
        headers: { host: HOST },
      })
    ).json<Record<string, unknown>>();

  it('shows the bananas by default, with no desktop app connected', async () => {
    expect(await get()).toEqual({
      walkers: true,
      hidden: [],
      connected: false,
    });
  });

  it('turns them off, refusing other sites and malformed bodies', async () => {
    expect((await put({ walkers: false }, 'https://evil.test')).statusCode).toBe(403);
    expect((await put({ walkers: 'no' })).statusCode).toBe(400);
    expect((await put({ walkers: false })).statusCode).toBe(200);
    expect(await get()).toEqual({
      walkers: false,
      hidden: [],
      connected: false,
    });
    // Remembered for the next start.
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      walkers: false,
      hidden: [],
    });
    const again = await buildApp({
      token: TOKEN,
      store,
      adapters: [],
      allowedOrigins: [ORIGIN],
      desktopPrefsFile: file,
    });
    await again.fastify.ready();
    const res = await again.fastify.inject({
      url: '/api/desktop',
      headers: { host: HOST },
    });
    expect(res.json()).toEqual({
      walkers: false,
      hidden: [],
      connected: false,
    });
    await again.close();
  });

  it('hides and shows one agent, remembering it', async () => {
    expect((await put({ agent: { id: 's1', hidden: true } })).statusCode).toBe(200);
    expect((await put({ agent: { id: 's2', hidden: true } })).statusCode).toBe(200);
    expect((await get()).hidden).toEqual(['s1', 's2']);
    await put({ agent: { id: 's1', hidden: false } });
    expect(await get()).toEqual({
      walkers: true,
      hidden: ['s2'],
      connected: false,
    });
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      walkers: true,
      hidden: ['s2'],
    });
    expect((await put({})).statusCode).toBe(400);
  });

  it('reads a setting saved before agents could be hidden', async () => {
    await writeFile(file, JSON.stringify({ walkers: false }));
    expect(loadDesktopPrefs(file)).toEqual({ walkers: false, hidden: [] });
  });

  it('knows when the desktop app is running', async () => {
    const ws = await desktopApp.fastify.injectWS('/ws?client=desktop', {
      headers: { host: HOST, origin: ORIGIN },
    });
    expect(await get()).toEqual({ walkers: true, hidden: [], connected: true });
    ws.terminate();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await get()).toEqual({
      walkers: true,
      hidden: [],
      connected: false,
    });
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

describe('typing to an agent', () => {
  const HANDLE = 'term_0f1e2d3c-aaaa-bbbb-cccc-000000000001';
  let typed: { handle: string; text: string }[];
  let state: 'ok' | 'gone' | 'not-claude';
  let typingApp: App;
  let typingStore: AgentStore;

  beforeEach(async () => {
    typed = [];
    state = 'ok';
    typingStore = new AgentStore();
    typingApp = await buildApp({
      token: TOKEN,
      store: typingStore,
      adapters: [createClaudeCodeAdapter(Date.now, { details: false })],
      allowedOrigins: [ORIGIN],
      uploadsDir: path.join(os.tmpdir(), `typing-uploads-${String(process.pid)}`),
      terminalSender: {
        check: () => Promise.resolve(state === 'ok' ? { ok: true } : { ok: false, reason: state }),
        send: (handle, text) => {
          typed.push({ handle, text });
          return Promise.resolve(true);
        },
        interrupt: (handle) => {
          typed.push({ handle, text: 'Esc' });
          return Promise.resolve(true);
        },
      },
    });
    await typingApp.fastify.ready();
  });
  afterEach(async () => {
    typingStore.dispose();
    await typingApp.close();
  });

  const hook = (terminal?: string) =>
    typingApp.fastify.inject({
      method: 'POST',
      url: '/events',
      headers: {
        host: HOST,
        'content-type': 'application/json',
        'x-token': TOKEN,
        ...(terminal === undefined ? {} : { 'x-orca-terminal': terminal }),
      },
      payload: JSON.stringify(start),
    });
  const stop = (origin = ORIGIN, id = 's1') =>
    typingApp.fastify.inject({
      method: 'POST',
      url: `/api/agents/${id}/interrupt`,
      headers: { host: HOST, origin },
    });
  const send = (text: unknown, origin = ORIGIN, id = 's1') =>
    typingApp.fastify.inject({
      method: 'POST',
      url: `/api/agents/${id}/send`,
      headers: { host: HOST, origin, 'content-type': 'application/json' },
      payload: JSON.stringify({ text }),
    });

  it('remembers the Orca terminal from the hook, ignoring a malformed one', async () => {
    await hook('term_bad;rm -rf');
    expect(typingStore.get('s1')?.terminal).toBeUndefined();
    await hook(HANDLE);
    expect(typingStore.get('s1')?.terminal).toBe(HANDLE);
  });

  it('types the message into that terminal', async () => {
    await hook(HANDLE);
    const res = await send('  Add a test for the 404 case  ');
    expect(res.statusCode).toBe(200);
    expect(typed).toEqual([{ handle: HANDLE, text: 'Add a test for the 404 case' }]);
  });

  it('refuses other sites, empty text, unknown agents and agents outside Orca', async () => {
    await hook(HANDLE);
    expect((await send('hi', 'https://evil.test')).statusCode).toBe(403);
    expect((await send('   ')).statusCode).toBe(400);
    expect((await send('hi', ORIGIN, 'nobody')).statusCode).toBe(404);
    typingStore.apply({
      sessionId: 's2',
      kind: 'claude-code',
      cwd: '/w/x',
      type: 'start',
      at: 1,
    });
    expect((await send('hi', ORIGIN, 's2')).statusCode).toBe(409);
    expect(typed).toEqual([]);
  });

  it('never types once Claude Code has left the terminal (it may be a plain shell now)', async () => {
    await hook(HANDLE);
    state = 'not-claude';
    const res = await send('ls');
    expect(res.statusCode).toBe(409);
    expect(res.json<{ error: string }>().error).toContain('no longer running');
    expect(typed).toEqual([]);
  });

  it('saves attached files and points the agent at them', async () => {
    await hook(HANDLE);
    const res = await typingApp.fastify.inject({
      method: 'POST',
      url: '/api/agents/s1/send',
      headers: {
        host: HOST,
        origin: ORIGIN,
        'content-type': 'application/json',
      },
      payload: JSON.stringify({
        text: 'What is wrong here?',
        files: [
          {
            name: 'error shot.png',
            type: 'image/png',
            data: Buffer.from('png').toString('base64'),
          },
        ],
      }),
    });
    expect(res.statusCode).toBe(200);
    const [message] = typed;
    expect(message?.text.startsWith('What is wrong here?\n\n@')).toBe(true);
    const file = message?.text.split('@')[1] ?? '';
    expect(file.endsWith('error-shot.png')).toBe(true);
    expect(await readFile(file, 'utf8')).toBe('png');
  });

  it('stops the agent with Esc, with the same checks', async () => {
    await hook(HANDLE);
    expect((await stop('https://evil.test')).statusCode).toBe(403);
    expect((await stop()).statusCode).toBe(200);
    expect(typed).toEqual([{ handle: HANDLE, text: 'Esc' }]);
    // Claude Code sends no hook for it, so the dashboard shows it stopped right away.
    expect(typingStore.get('s1')).toMatchObject({ state: 'idle' });
    expect(typingStore.get('s1')?.activity[0]?.summary).toBe('Stopped from the dashboard');
    state = 'not-claude';
    expect((await stop()).statusCode).toBe(409);
    expect(typed).toHaveLength(1);
  });

  it('is off without a sender (SEND_TO_AGENTS=off)', async () => {
    const res = await app.fastify.inject({
      method: 'POST',
      url: '/api/agents/s1/send',
      headers: {
        host: HOST,
        origin: ORIGIN,
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ text: 'hi' }),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('custom agents', () => {
  let dir: string;
  let agentsApp: App;
  const build = async (editable: boolean) => {
    agentsApp = await buildApp({
      token: TOKEN,
      store,
      adapters: [createClaudeCodeAdapter(Date.now, { details: false })],
      allowedOrigins: [ORIGIN],
      customAgents: {
        userDir: path.join(dir, 'agents'),
        trashDir: path.join(dir, 'trash'),
        editable,
      },
    });
    await agentsApp.fastify.ready();
  };
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'agent-office-'));
  });
  afterEach(async () => {
    await agentsApp.close();
    await rm(dir, { recursive: true, force: true });
  });

  const agent = {
    name: 'reviewer',
    description: 'Reviews code',
    tools: null,
    model: null,
    color: null,
    prompt: 'Review.',
  };
  const send = (method: 'POST' | 'DELETE', body: unknown, origin = ORIGIN) =>
    agentsApp.fastify.inject({
      method,
      url: '/api/custom-agents',
      headers: { host: HOST, origin, 'content-type': 'application/json' },
      payload: JSON.stringify(body),
    });
  const list = async () =>
    (
      await agentsApp.fastify.inject({
        url: '/api/custom-agents',
        headers: { host: HOST },
      })
    ).json<{
      editable: boolean;
      scopes: { id: string }[];
      agents: { file: string; modifiedAt: number }[];
    }>();

  it('creates, updates and trashes an agent of yours', async () => {
    await build(true);
    expect((await send('POST', { scope: 'user', agent })).statusCode).toBe(201);
    const [created] = (await list()).agents;
    expect(created?.file).toBe('reviewer.md');

    const updated = await send('POST', {
      scope: 'user',
      file: 'reviewer.md',
      modifiedAt: created?.modifiedAt,
      agent: { ...agent, model: 'opus' },
    });
    expect(updated.statusCode).toBe(200);
    expect(await readFile(path.join(dir, 'agents', 'reviewer.md'), 'utf8')).toContain(
      'model: opus',
    );

    expect((await send('DELETE', { scope: 'user', file: 'reviewer.md' })).statusCode).toBe(200);
    expect((await list()).agents).toEqual([]);
  });

  it('offers the folder of each agent here as a project', async () => {
    await build(true);
    await postEventTo(agentsApp, { ...start, cwd: dir });
    expect((await list()).scopes.map((s) => s.id)).toEqual(['user', `project:${dir}`]);
    expect((await send('POST', { scope: `project:${dir}`, agent })).statusCode).toBe(201);
    expect(await readFile(path.join(dir, '.claude', 'agents', 'reviewer.md'), 'utf8')).toContain(
      'name: reviewer',
    );
    expect((await send('POST', { scope: 'project:/elsewhere', agent })).statusCode).toBe(404);
  });

  it('refuses other sites, bad names, and any change when editing is off', async () => {
    await build(true);
    expect((await send('POST', { scope: 'user', agent }, 'https://evil.example')).statusCode).toBe(
      403,
    );
    const bad = await send('POST', {
      scope: 'user',
      agent: { ...agent, name: '../Evil' },
    });
    expect(bad.statusCode).toBe(400);
    await agentsApp.close();

    await build(false);
    expect((await list()).editable).toBe(false);
    expect((await send('POST', { scope: 'user', agent })).statusCode).toBe(403);
  });
});

function postEventTo(target: App, body: unknown) {
  return target.fastify.inject({
    method: 'POST',
    url: '/events',
    headers: {
      host: HOST,
      'content-type': 'application/json',
      'x-token': TOKEN,
    },
    payload: JSON.stringify(body),
  });
}

describe('starting a task', () => {
  let dir: string;
  let taskApp: App;
  let calls: { kind: string; target: string; name?: string; prompt: string }[];
  const places: Places = {
    repos: [{ id: 'r1', name: 'app', path: '/code/app' }],
    worktrees: [
      {
        id: 'w1',
        repoId: 'r1',
        name: 'main',
        path: '/code/app',
        branch: 'main',
        main: true,
      },
    ],
  };
  const launcher: AgentLauncher = {
    places: () => Promise.resolve(places),
    startInNewWorktree: (repoId, name, prompt) => {
      calls.push({ kind: 'new', target: repoId, name, prompt });
      return Promise.resolve({ ok: true });
    },
    startInWorktree: (worktreeId, prompt) => {
      calls.push({ kind: 'existing', target: worktreeId, prompt });
      return Promise.resolve({ ok: true });
    },
  };
  beforeEach(async () => {
    calls = [];
    dir = await mkdtemp(path.join(os.tmpdir(), 'agent-office-'));
    await mkdir(path.join(dir, 'agents'));
    await writeFile(
      path.join(dir, 'agents', 'reviewer.md'),
      '---\nname: reviewer\ndescription: Reviews code\n---\nReview.\n',
    );
    taskApp = await buildApp({
      token: TOKEN,
      store,
      adapters: [],
      allowedOrigins: [ORIGIN],
      agentLauncher: launcher,
      customAgents: {
        userDir: path.join(dir, 'agents'),
        trashDir: dir,
        editable: true,
      },
    });
    await taskApp.fastify.ready();
  });
  afterEach(async () => {
    await taskApp.close();
    await rm(dir, { recursive: true, force: true });
  });
  const start = (body: unknown, origin = ORIGIN) =>
    taskApp.fastify.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { host: HOST, origin, 'content-type': 'application/json' },
      payload: JSON.stringify(body),
    });

  it('lists where a task can run', async () => {
    const res = await taskApp.fastify.inject({
      url: '/api/tasks/places',
      headers: { host: HOST },
    });
    expect(res.json()).toEqual({ enabled: true, reachable: true, ...places });
  });

  it('starts Claude Code in a new worktree, telling the lead about its team', async () => {
    const res = await start({
      task: 'Add a settings page',
      where: { kind: 'new', repoId: 'r1', name: 'settings-page' },
      team: ['reviewer'],
    });
    expect(res.statusCode).toBe(201);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      kind: 'new',
      target: 'r1',
      name: 'settings-page',
    });
    expect(calls[0]?.prompt).toContain('Add a settings page\n\nYou lead this task');
    expect(calls[0]?.prompt).toContain('- reviewer: Reviews code');
  });

  it('starts it in an existing worktree with the task alone', async () => {
    const res = await start({
      task: 'Fix it',
      where: { kind: 'existing', worktreeId: 'w1' },
    });
    expect(res.statusCode).toBe(201);
    expect(calls).toEqual([{ kind: 'existing', target: 'w1', prompt: 'Fix it' }]);
  });

  it('refuses other sites, places Orca did not list, and unknown helpers', async () => {
    const where = { kind: 'existing', worktreeId: 'w1' };
    expect((await start({ task: 'x', where }, 'https://evil.example')).statusCode).toBe(403);
    expect(
      (
        await start({
          task: 'x',
          where: { kind: 'existing', worktreeId: 'w9' },
        })
      ).statusCode,
    ).toBe(404);
    const unknown = await start({ task: 'x', where, team: ['ghost'] });
    expect(unknown.statusCode).toBe(400);
    expect(unknown.json<{ error: string }>().error).toContain('ghost');
    expect(calls).toEqual([]);
  });

  it('is off without a launcher (START_AGENTS=off)', async () => {
    const res = await app.fastify.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: {
        host: HOST,
        origin: ORIGIN,
        'content-type': 'application/json',
      },
      payload: JSON.stringify({
        task: 'x',
        where: { kind: 'existing', worktreeId: 'w1' },
      }),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('GET /api/usage', () => {
  it('is off without a reader, checks the range, and passes it on', async () => {
    const get = (target: App, url: string) =>
      target.fastify.inject({ method: 'GET', url, headers: { host: HOST } });
    expect((await get(app, '/api/usage')).statusCode).toBe(403);

    const asked: string[] = [];
    const withUsage = await buildApp({
      token: TOKEN,
      store,
      adapters: [],
      allowedOrigins: [ORIGIN],
      usageReader: (range) => {
        asked.push(range);
        return Promise.resolve({ range } as never);
      },
    });
    await withUsage.fastify.ready();
    expect((await get(withUsage, '/api/usage?range=week')).statusCode).toBe(400);
    const res = await get(withUsage, '/api/usage?range=7d');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ range: '7d' });
    await get(withUsage, '/api/usage');
    expect(asked).toEqual(['7d', 'today']);
    await withUsage.close();
  });
});
