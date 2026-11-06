import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { CustomAgentInput, CustomAgentScope } from '@agent-office/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CustomAgentError,
  agentScopes,
  listCustomAgents,
  parseAgentText,
  renderAgentText,
  saveCustomAgent,
  trashCustomAgent,
  userAgentsDir,
} from './custom-agents.js';

let root: string;
let scope: CustomAgentScope;
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'custom-agents-'));
  scope = {
    id: 'user',
    kind: 'user',
    label: 'Yours',
    dir: path.join(root, 'agents'),
    exists: true,
  };
  await mkdir(scope.dir, { recursive: true });
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const MANAGED = `---
# Managed by Agent Workspace. Edits made here are replaced.
name: ahhhh
description: "Front-End helper"
permissionMode: plan
---

You are Ahhhh.
`;

const input = (patch: Partial<CustomAgentInput> = {}): CustomAgentInput => ({
  name: 'reviewer',
  description: 'Reviews code after changes',
  tools: ['Read', 'Grep'],
  model: 'sonnet',
  color: 'blue',
  prompt: 'You review code.',
  ...patch,
});

const rejection = async (promise: Promise<unknown>): Promise<CustomAgentError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CustomAgentError) return error;
    throw error;
  }
  throw new Error('expected a refusal');
};

describe('reading agent files', () => {
  it('finds files in subfolders and reads their fields and the note on top', async () => {
    await mkdir(path.join(scope.dir, 'team'));
    await writeFile(path.join(scope.dir, 'team', 'ahhhh.md'), MANAGED);
    await writeFile(
      path.join(scope.dir, 'lister.md'),
      '---\nname: lister\ndescription: Lists\ntools:\n  - Read\n  - Glob\nmodel: haiku\n---\nList.\n',
    );
    await writeFile(path.join(scope.dir, 'notes.txt'), 'not an agent');

    const agents = await listCustomAgents([scope]);
    expect(agents.map((a) => a.file)).toEqual(['lister.md', 'team/ahhhh.md']);
    const [lister, managed] = agents;
    expect(lister).toMatchObject({ name: 'lister', tools: ['Read', 'Glob'], model: 'haiku' });
    expect(managed).toMatchObject({
      name: 'ahhhh',
      description: 'Front-End helper',
      tools: null,
      model: null,
      prompt: 'You are Ahhhh.\n',
      note: 'Managed by Agent Workspace. Edits made here are replaced.',
      problem: null,
    });
  });

  it('flags files it cannot edit instead of failing the list', () => {
    expect(parseAgentText('Just a prompt').problem).toMatch(/No frontmatter/);
    expect(parseAgentText('---\nname: [oops\n---\nx').problem).toMatch(/not valid YAML/);
    expect(parseAgentText('---\n- a\n- b\n---\nx').problem).toMatch(/key: value/);
  });
});

describe('writing agent files', () => {
  it('keeps comments, quoting and keys it does not edit, and drops cleared fields', () => {
    const text = renderAgentText(MANAGED, input({ name: 'ahhhh', tools: null, color: null }));
    expect(text).toBe(
      '---\n# Managed by Agent Workspace. Edits made here are replaced.\nname: ahhhh\n' +
        'description: "Reviews code after changes"\npermissionMode: plan\nmodel: sonnet\n---\n\n' +
        'You review code.\n',
    );
  });

  it('keeps a tools list a list', () => {
    const text = renderAgentText(
      '---\nname: a\ndescription: b\ntools:\n  - Read\n---\n',
      input({ name: 'a', tools: ['Read', 'Bash(git status:*)'] }),
    );
    expect(text).toContain('tools:\n  - Read\n  - Bash(git status:*)\n');
  });

  it('creates a new file named after the agent, never over another', async () => {
    const saved = await saveCustomAgent(scope, input());
    expect(saved.file).toBe('reviewer.md');
    expect(await readFile(path.join(scope.dir, 'reviewer.md'), 'utf8')).toBe(
      '---\nname: reviewer\ndescription: Reviews code after changes\ntools: Read, Grep\n' +
        'model: sonnet\ncolor: blue\n---\n\nYou review code.\n',
    );
    expect((await rejection(saveCustomAgent(scope, input()))).status).toBe(409);
  });

  it('refuses a name another file already uses', async () => {
    await mkdir(path.join(scope.dir, 'team'));
    await writeFile(
      path.join(scope.dir, 'team', 'x.md'),
      '---\nname: reviewer\ndescription: d\n---\n',
    );
    const error = await rejection(saveCustomAgent(scope, input()));
    expect(error.message).toContain('team/x.md');
  });

  it('updates in place, keeping the file mode, unless it changed on disk meanwhile', async () => {
    const file = path.join(scope.dir, 'team.md');
    await writeFile(file, MANAGED, { mode: 0o600 });
    const [before] = await listCustomAgents([scope]);
    if (before === undefined) throw new Error('missing');

    const saved = await saveCustomAgent(scope, input({ name: 'ahhhh' }), {
      file: 'team.md',
      modifiedAt: before.modifiedAt,
    });
    expect(saved.description).toBe('Reviews code after changes');
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(await readdir(scope.dir)).toEqual(['team.md']);

    const stale = await rejection(
      saveCustomAgent(scope, input({ name: 'ahhhh' }), { file: 'team.md', modifiedAt: 1 }),
    );
    expect(stale.status).toBe(409);
  });

  it('stays inside the agents folder and away from links', async () => {
    expect((await rejection(saveCustomAgent(scope, input(), { file: '../x.md' }))).status).toBe(
      400,
    );
    expect((await rejection(saveCustomAgent(scope, input(), { file: 'gone.md' }))).status).toBe(
      404,
    );
    await writeFile(path.join(root, 'elsewhere.md'), MANAGED);
    await symlink(path.join(root, 'elsewhere.md'), path.join(scope.dir, 'link.md'));
    expect(
      (await rejection(saveCustomAgent(scope, input({ name: 'ahhhh' }), { file: 'link.md' })))
        .status,
    ).toBe(409);
  });

  it('will not rewrite a file whose frontmatter is broken', async () => {
    await writeFile(path.join(scope.dir, 'bad.md'), 'no frontmatter here');
    const error = await rejection(saveCustomAgent(scope, input(), { file: 'bad.md' }));
    expect(error.message).toMatch(/fix the file by hand/);
  });

  it('moves a deleted file to the trash', async () => {
    await saveCustomAgent(scope, input());
    const trash = path.join(root, 'trash');
    const target = await trashCustomAgent(scope, 'reviewer.md', trash);
    expect(path.dirname(target)).toBe(trash);
    expect(await readdir(scope.dir)).toEqual([]);
    expect(await readFile(target, 'utf8')).toContain('name: reviewer');
    expect((await rejection(trashCustomAgent(scope, 'reviewer.md', trash))).status).toBe(404);
  });
});

describe('agent folders', () => {
  it('lists yours, then each existing project once, skipping your home', async () => {
    const project = path.join(root, 'project');
    await mkdir(path.join(project, '.claude', 'agents'), { recursive: true });
    const scopes = await agentScopes(path.join(root, '.claude', 'agents'), [
      project,
      project,
      root,
      path.join(root, 'missing'),
      'relative/path',
    ]);
    expect(scopes.map((s) => [s.id, s.exists])).toEqual([
      ['user', false],
      [`project:${project}`, true],
    ]);
  });

  it('follows CLAUDE_CONFIG_DIR', () => {
    expect(userAgentsDir({ CLAUDE_CONFIG_DIR: '/x/claude' })).toBe('/x/claude/agents');
    expect(userAgentsDir({})).toBe(path.join(os.homedir(), '.claude', 'agents'));
  });
});
