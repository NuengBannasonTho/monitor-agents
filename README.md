<h1 align="center">Agent Office</h1>

<p align="center">
  A local pixel office for your Claude Code agents in Orca.<br>
  <strong>Read-only · Localhost only · No telemetry</strong>
</p>

<p align="center">
  <img src="agent-office-2.gif" alt="Illustrated preview of the eight agent states" width="960">
</p>

## Quick start

Requires **Node.js ≥22.12**, **pnpm ≥10**, `curl`, and **Claude Code with hooks** on macOS or Linux (WSL for Windows; untested).

```bash
pnpm install
pnpm start
```

In another terminal:

```bash
pnpm install-hooks
pnpm diagnose
```

Open **http://127.0.0.1:4777**, then start Claude Code in your Orca worktrees. Restart existing sessions after installing hooks. Keep `pnpm start` running.

## Features

- Pixel workers show agent activity and highlight permission/input requests.
- Click a worker for session details and recent activity.
- Optional sound alerts, custom skins, system themes, and reduced motion.

## Custom skins

![Custom skins](/custom-skins.gif)

```bash
pnpm skins:import ./my-skin-folder
```

## Useful commands

![Useful commands](/useful-commands.gif)

```bash
pnpm diagnose
pnpm dev:mock
pnpm uninstall-hooks
```

## Good to know

- No outbound calls. Prompts and full messages are never stored; short activity summaries redact detected secrets.
- Subagent activity appears on the parent worker.
- Long tool calls may appear stale; the next event restores activity.
- Restarting the server clears the office until new events arrive.
