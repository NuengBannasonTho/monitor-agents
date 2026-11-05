/**
 * pnpm diagnose: checks every link between Claude Code and the UI, then walks a
 * test agent through emit.sh so you can watch it appear in the office.
 */
import { spawn } from 'node:child_process';
import { access, constants, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SkinIndexSchema } from '@agent-office/shared';
import { countOurHooks, hookCommand, isObject, missingHookEvents } from './hooks/settings.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const EMIT = path.resolve(here, 'emit.sh');
const HOME = process.env.AGENT_OFFICE_HOME ?? path.join(os.homedir(), '.agent-office');
const PORT = Number.parseInt(process.env.PORT ?? process.env.AGENT_OFFICE_PORT ?? '4777', 10);
const BASE = `http://127.0.0.1:${PORT}`;
const SETTINGS = path.join(
  process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude'),
  'settings.json',
);

type Status = 'ok' | 'warn' | 'fail';
let failures = 0;

function report(status: Status, what: string, detail = ''): void {
  const icon = status === 'ok' ? '✔' : status === 'warn' ? '!' : '✖';
  if (status === 'fail') failures++;
  console.log(`${icon} ${what}${detail === '' ? '' : `\n    ${detail}`}`);
}

async function privateFile(file: string): Promise<boolean> {
  try {
    return ((await stat(file)).mode & 0o077) === 0;
  } catch {
    return false;
  }
}

function emit(payload: object): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(EMIT, [], { stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('close', (code) => {
      resolve(code ?? 1);
    });
    child.on('error', () => {
      resolve(127);
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

async function main(): Promise<void> {
  console.log('Agent Office diagnose\n');

  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
  if (major > 22 || (major === 22 && minor >= 12)) report('ok', `Node ${process.versions.node}`);
  else report('fail', `Node ${process.versions.node}`, 'Agent Office needs Node 22.12 or newer.');

  const curl = await new Promise<boolean>((resolve) => {
    spawn('curl', ['--version'], { stdio: 'ignore' })
      .on('close', (c) => {
        resolve(c === 0);
      })
      .on('error', () => {
        resolve(false);
      });
  });
  if (curl) report('ok', 'curl is installed');
  else report('fail', 'curl is missing', 'emit.sh uses curl to reach the server.');

  try {
    await access(EMIT, constants.X_OK);
    report('ok', `emit.sh is executable (${EMIT})`);
  } catch {
    report('fail', 'emit.sh is not executable', `Run: chmod +x ${EMIT}`);
  }

  const headers = path.join(HOME, 'curl-headers');
  if (await privateFile(path.join(HOME, 'token'))) {
    if (await privateFile(headers)) report('ok', `Token files in ${HOME} (mode 0600)`);
    else
      report(
        'fail',
        'curl-headers file missing',
        'Start the server once (pnpm start) to create it.',
      );
  } else {
    report(
      'fail',
      `No private token in ${HOME}`,
      'Start the server once (pnpm start) to create it.',
    );
  }

  let serverUp: boolean;
  try {
    const res = await fetch(`${BASE}/healthz`, { signal: AbortSignal.timeout(1500) });
    serverUp = res.ok;
  } catch {
    serverUp = false;
  }
  if (serverUp) report('ok', `Server is running at ${BASE}`);
  else report('fail', `Server not reachable at ${BASE}`, 'Start it with: pnpm start');

  try {
    const parsed: unknown = JSON.parse(await readFile(SETTINGS, 'utf8'));
    const settings = isObject(parsed) ? parsed : {};
    const count = countOurHooks(settings);
    const current = JSON.stringify(settings).includes(
      JSON.stringify(hookCommand(EMIT)).slice(1, -1),
    );
    if (count === 0)
      report('fail', `No Agent Office hooks in ${SETTINGS}`, 'Run: pnpm install-hooks');
    else if (!current)
      report(
        'warn',
        `${count} hooks found, but they point to another copy of emit.sh`,
        'Run: pnpm install-hooks (it updates the path)',
      );
    else if (missingHookEvents(settings).length > 0)
      report(
        'warn',
        `Hooks installed, but not for ${missingHookEvents(settings).join(', ')}`,
        'Run: pnpm install-hooks (adds the new ones)',
      );
    else report('ok', `${count} hooks installed in ${SETTINGS}`);
  } catch {
    report('fail', `Cannot read ${SETTINGS}`, 'Run: pnpm install-hooks');
  }

  if (serverUp) {
    try {
      const res = await fetch(`${BASE}/api/skins`, { headers: { host: `127.0.0.1:${PORT}` } });
      const body = SkinIndexSchema.parse(await res.json());
      report(
        'ok',
        body.packs.length === 0
          ? 'No skin packs (built-in pixel workers will be used)'
          : `Skin packs: ${body.packs.map((p) => p.manifest.name).join(', ')}`,
      );
    } catch {
      report('warn', 'Could not list skin packs');
    }
  }

  if (failures > 0) {
    console.log(`\n${failures} problem(s) found. Fix them and run pnpm diagnose again.`);
    process.exit(1);
  }

  console.log(`\nSending a test agent through emit.sh. Watch ${BASE} …`);
  const session = {
    session_id: `diagnose-${Date.now()}`,
    cwd: path.join(os.tmpdir(), 'diagnose-check'),
  };
  const steps: [string, object][] = [
    ['SessionStart', { source: 'startup' }],
    ['UserPromptSubmit', { prompt: 'diagnose' }],
    ['PreToolUse', { tool_name: 'Read', tool_input: { file_path: `${session.cwd}/README.md` } }],
    ['Stop', { stop_hook_active: false }],
  ];
  for (const [event, extra] of steps) {
    const code = await emit({ ...session, hook_event_name: event, ...extra });
    if (code !== 0) report('fail', `emit.sh exited with ${code}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  await new Promise((r) => setTimeout(r, 4000));
  await emit({ ...session, hook_event_name: 'SessionEnd', reason: 'other' });
  console.log(
    '✔ Done. You should have seen "diagnose-check" sit at the table, read, finish and leave.',
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
