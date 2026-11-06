import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isRecord } from '@agent-office/shared';

/*
 * Typing to an agent from the dashboard, through Orca's CLI (`orca terminal ...`). The text
 * goes in as an agent prompt (`--enter`, bracketed paste: control bytes are made inert), and
 * only after Orca confirms the terminal is live and still running Claude Code, so nothing is
 * ever typed into a plain shell.
 */

export type TerminalCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'gone' | 'not-claude' | 'unavailable' };

export interface TerminalSender {
  /** Whether the terminal is live, writable and running Claude Code. */
  check(handle: string): Promise<TerminalCheck>;
  /** Types the text and presses Enter; true once Orca accepted it. */
  send(handle: string, text: string): Promise<boolean>;
  /**
   * Stops what the agent is doing, as pressing Esc does in Claude Code: the turn ends, the
   * session stays open. (Not Ctrl+C: twice in a row, that quits Claude Code.)
   */
  interrupt(handle: string): Promise<boolean>;
}

const TIMEOUT_MS = 10_000;

/** Orca's JSON reply; it exits non-zero on a refusal (a closed terminal) but still says why. */
export function runOrca(
  bin: string,
  args: readonly string[],
  timeoutMs: number = TIMEOUT_MS,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      [...args],
      { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout) => {
        try {
          resolve(JSON.parse(stdout) as unknown);
        } catch {
          reject(error ?? new Error('bad JSON from orca'));
        }
      },
    );
  });
}

/**
 * Orca's CLI: ORCA_BIN, else the installed app's (a fixed path, unlike the `orca` on PATH in
 * Orca terminals, which moves each launch while macOS runs a quarantined app from a temporary
 * copy), else `orca` on PATH.
 */
export function defaultOrcaBin(env: NodeJS.ProcessEnv = process.env): string {
  if (env.ORCA_BIN !== undefined && env.ORCA_BIN !== '') return env.ORCA_BIN;
  const installed = [
    '/Applications/Orca.app/Contents/Resources/bin/orca',
    path.join(os.homedir(), 'Applications', 'Orca.app', 'Contents', 'Resources', 'bin', 'orca'),
  ].find((candidate) => existsSync(candidate));
  return installed ?? 'orca';
}

export function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

/** Orca's CLI; `ORCA_BIN` overrides where it is (it is on PATH inside Orca terminals). */
export function orcaSender(bin: string = defaultOrcaBin()): TerminalSender {
  return {
    async check(handle) {
      let reply: unknown;
      try {
        reply = await runOrca(bin, ['terminal', 'show', '--terminal', handle, '--json']);
      } catch {
        return { ok: false, reason: 'unavailable' };
      }
      const body = record(reply);
      if (body.ok !== true) return { ok: false, reason: 'gone' };
      const terminal = record(record(body.result).terminal);
      if (terminal.connected !== true || terminal.writable !== true || terminal.orphaned === true) {
        return { ok: false, reason: 'gone' };
      }
      return terminal.agentIdentity === 'claude'
        ? { ok: true }
        : { ok: false, reason: 'not-claude' };
    },
    async interrupt(handle) {
      try {
        // A bare Esc byte, written as is (no --enter, so no paste and no Enter).
        const reply = record(
          await runOrca(bin, ['terminal', 'send', '--terminal', handle, '--text=\u001b', '--json']),
        );
        return reply.ok === true;
      } catch {
        return false;
      }
    },
    async send(handle, text) {
      try {
        const reply = record(
          // `--text=` keeps a message that starts with "--" from reading as a flag.
          await runOrca(bin, [
            'terminal',
            'send',
            '--terminal',
            handle,
            `--text=${text}`,
            '--enter',
            '--json',
          ]),
        );
        return reply.ok === true;
      } catch {
        return false;
      }
    },
  };
}
