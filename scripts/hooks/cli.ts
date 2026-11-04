/**
 * pnpm install-hooks   [--yes] [--dry-run] [--settings <path>]
 * pnpm uninstall-hooks [--yes] [--dry-run] [--settings <path>]
 *
 * Shows a diff of ~/.claude/settings.json, asks before writing, backs the file
 * up to settings.json.bak-<timestamp>, and writes atomically.
 */
import { chmod, copyFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ensureToken } from '../../apps/server/src/token.js';
import type { JsonObject } from './settings.js';
import {
  HOOK_EVENTS,
  SettingsShapeError,
  compactDiff,
  countOurHooks,
  detectIndent,
  isObject,
  lineDiff,
  mergeHooks,
  stringify,
  unmergeHooks,
} from './settings.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const EMIT_PATH = path.resolve(here, '..', 'emit.sh');

function defaultSettingsPath(): string {
  const configDir = process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude');
  return path.join(configDir, 'settings.json');
}

function timestamp(d = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function readSettings(file: string): Promise<{ text: string | null; settings: JsonObject }> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { text: null, settings: {} };
    }
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${file} is not valid JSON. Fix it first; nothing was changed.`);
  }
  if (!isObject(parsed))
    throw new Error(`${file} should contain a JSON object; nothing was changed.`);
  return { text, settings: parsed };
}

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(question);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

function colorize(line: string): string {
  if (!process.stdout.isTTY) return line;
  if (line.startsWith('+')) return `\x1b[32m${line}\x1b[0m`;
  if (line.startsWith('-')) return `\x1b[31m${line}\x1b[0m`;
  return `\x1b[2m${line}\x1b[0m`;
}

async function writeAtomically(file: string, content: string, mode: number): Promise<void> {
  const tmp = `${file}.agent-office-${process.pid}.tmp`;
  await writeFile(tmp, content, { mode });
  await chmod(tmp, mode);
  await rename(tmp, file);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      yes: { type: 'boolean', short: 'y', default: false },
      'dry-run': { type: 'boolean', default: false },
      settings: { type: 'string' },
    },
  });
  const action = positionals[0];
  if (action !== 'install' && action !== 'uninstall') {
    throw new Error('usage: cli.ts install|uninstall [--yes] [--dry-run] [--settings path]');
  }
  const file = values.settings ?? defaultSettingsPath();
  const { text, settings } = await readSettings(file);

  if (action === 'install') {
    await chmod(EMIT_PATH, 0o755);
    const homeDir = process.env.AGENT_OFFICE_HOME ?? path.join(os.homedir(), '.agent-office');
    await ensureToken(homeDir);
  }

  const next = action === 'install' ? mergeHooks(settings, EMIT_PATH) : unmergeHooks(settings);
  const indent = text === null ? 2 : detectIndent(text);
  const before = text ?? '';
  const after = stringify(next, indent);

  console.log(`\n${action === 'install' ? 'Install' : 'Remove'} Agent Office hooks in ${file}`);
  if (action === 'install') {
    console.log(`Events: ${HOOK_EVENTS.map((e) => e.event).join(', ')}`);
    console.log(`Command: ${EMIT_PATH} (async, never blocks the agent)`);
  }

  if (before === after || (text === null && action === 'uninstall')) {
    console.log('\nNothing to change.');
    return;
  }

  console.log('');
  for (const line of compactDiff(lineDiff(before, after))) console.log(colorize(line));
  console.log('');

  if (values['dry-run']) {
    console.log('Dry run: nothing written.');
    return;
  }
  if (!values.yes) {
    if (!process.stdin.isTTY) {
      throw new Error('Not a terminal: re-run with --yes to write without a prompt.');
    }
    if (!(await confirm('Write these changes? [y/N] '))) {
      console.log('Cancelled. Nothing written.');
      return;
    }
  }

  let mode = 0o600;
  if (text !== null) {
    mode = (await stat(file)).mode & 0o777;
    const backup = `${file}.bak-${timestamp()}`;
    await copyFile(file, backup);
    console.log(`Backup: ${backup}`);
  } else {
    await mkdir(path.dirname(file), { recursive: true });
  }
  await writeAtomically(file, after, mode);
  console.log(
    action === 'install'
      ? `Done: ${countOurHooks(next)} hooks installed. New Claude Code sessions will report to Agent Office.`
      : 'Done: Agent Office hooks removed.',
  );
}

main().catch((error: unknown) => {
  if (error instanceof SettingsShapeError) {
    console.error(`Unexpected settings.json shape: ${error.message}. Nothing was changed.`);
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exit(1);
});
