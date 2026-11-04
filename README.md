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

<details>
<summary>🎨 Custom skins</summary>

Create a pack using [example.skin.json](skins/example.skin.json), then import:

```bash
pnpm skins:import ./my-skin-folder
```

Reload and choose **Pixel**, **By task**, or **By desk**. Personal packs stay in `~/.agent-office/skins/`, outside the repo.

</details>

<details>
<summary>🛠️ Useful commands</summary>

```bash
pnpm diagnose           # troubleshoot setup
pnpm dev:mock           # develop with simulated agents
pnpm uninstall-hooks    # remove Agent Office hooks
```

Hook changes are previewed before writing, with automatic settings backups.

</details>

## Good to know

- No outbound calls. Prompts and full messages are never stored; short activity summaries redact detected secrets.
- Subagent activity appears on the parent worker.
- Long tool calls may appear stale; the next event restores activity.
- Restarting the server clears the office until new events arrive.
