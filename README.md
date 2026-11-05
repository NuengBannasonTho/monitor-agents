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

Open **http://127.0.0.1:4777**, then start Claude Code in your Orca worktrees. Restart existing sessions after installing hooks. Keep `pnpm start` running. After updating Agent Office, run `pnpm install-hooks` again to add any new hooks.

## Features

- Busy agents sit at desks in **Agent Work**; waiting agents relax around the campfire at **Base Camp**. Collapse either half to give the other the full width.
- Pixel workers show agent activity and highlight permission/input requests. The header, tab title and icon show who is waiting on you, and unread finishes get a green **new** flag.
- Click a worker for session details, timing, and recent activity (failed commands in red), plus **Open in VS Code** and **Copy resume command**.
- Optional sound and desktop alerts, custom skins, a light/dark/system theme switch, and reduced motion.

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
- Agents stay in the office while a long tool call runs, for up to 30 minutes (`TOOL_STALE_AFTER_MIN`).
- Restarting the server clears the office until new events arrive.
