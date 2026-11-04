# Agent Office

A local, read-only monitor for AI coding agents in Orca. Claude Code sessions appear as pixel workers: active agents work at city desks, while idle agents wander a forest. Expressions and costumes show their activity.

No Orca modifications or outbound calls.

```text
Claude Code → scripts/emit.sh → POST /events → 127.0.0.1:4777 → WebSocket → browser
```

## Requirements

- macOS or Linux; Windows is untested (use WSL).
- Node.js ≥22.12, pnpm ≥10, and `curl`.
- Claude Code with hooks (verified with 2.1.318).

## Quick start

```bash
pnpm install
pnpm start              # http://127.0.0.1:4777
```

In another terminal:

```bash
pnpm install-hooks      # preview settings changes and confirm
pnpm diagnose           # check setup and send a test agent
```

Open http://127.0.0.1:4777 and start Claude Code in your Orca worktrees. Restart sessions opened before hook installation, and keep `pnpm start` running.

## Using the office

| State | Location | Trigger |
| --- | --- | --- |
| idle | Forest | Session start; 3 seconds after done |
| called | City | Prompt sent |
| reading | City | Read, Grep, Glob |
| running | City | Bash |
| working | City | Other tools, including Edit, Write, Agent |
| needs-you | City | Permission or input requested |
| done | Forest | Turn finished |
| stale | Forest | No events for 5 minutes |

Each city worker has a desk with a state-colored monitor. A red `!` and header highlight indicate agents waiting on you.

- **Header:** counts agents by state.
- **Worker details:** click to view agent kind, worktree, folder, session, and the last 20 activity lines. Click again or press Escape to close.
- **Sound:** optional waiting chime, off by default; enable with a click.
- **Appearance:** follows your system theme and reduced-motion setting.

## Custom skins

Personal packs live outside the repo in `~/.agent-office/skins/<pack>/`.

- **Pixel:** built-in workers.
- **By task:** a costume for each state.
- **By desk:** a saved costume per worktree, selected in worker details; `stateOverrides` still apply.

Add images with plain light backgrounds and a `skin.json` based on [the example](skins/example.skin.json), then import:

```bash
pnpm skins:import ./my-skin-folder
pnpm skins:import ./my-skin-folder --size 48 --pack my-crew
```

The importer removes backgrounds, applies a shared crop, downsamples to a square pixel grid (64 by default), and reduces colors. Reload to load the pack.

## Configuration

Environment variables for `pnpm start`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4777` | Server port; also set `AGENT_OFFICE_PORT` for hooks |
| `STALE_AFTER_MIN` | `5` | Inactivity before stale |
| `REMOVE_AFTER_MIN` | `10` | Inactivity before removal |
| `NEEDS_YOU_REMOVE_AFTER_MIN` | `60` | Removal timeout for waiting agents |
| `LOG_LEVEL` | `info` | Use `debug` to inspect received/dropped events |
| `AGENT_OFFICE_HOME` | `~/.agent-office` | Token and skins directory |

`emit.sh` reads `AGENT_OFFICE_HOME` and `AGENT_OFFICE_PORT`. Hook installation honors `CLAUDE_CONFIG_DIR` and supports `--settings <path>`, `--dry-run`, and `--yes`.

## Privacy and security

- Localhost only, no telemetry or outbound calls; state stays in memory.
- Events require `~/.agent-office/token`; token/header files use `0600` permissions, and the token stays out of process arguments.
- WebSocket Origin and HTTP Host checks protect local endpoints.
- Prompts, full tool inputs, and assistant messages are never stored or displayed. Activity shows only tool names and short targets (commands limited to 80 characters), with detected secrets replaced by `[REDACTED]`.

## Troubleshooting

Run `pnpm diagnose` first to check dependencies, relay, token, server, and hooks through a real test event.

| Problem | Fix |
| --- | --- |
| Offline | Run `pnpm start`; the page reconnects automatically |
| Empty office | Restart Claude Code after installing hooks |
| Repo moved / hooks target another copy | Run `pnpm install-hooks` again |
| Agent disappears during a long tool call | Increase `STALE_AFTER_MIN` / `REMOVE_AFTER_MIN` |
| Port occupied | Run `PORT=4800 pnpm start`; export `AGENT_OFFICE_PORT=4800` where Claude Code runs |
| Invalid settings JSON | Fix the settings file or restore a backup; installation leaves invalid JSON untouched |
| Skin switcher missing | Check packs under `~/.agent-office/skins` and server logs |
| Events ignored | Run `LOG_LEVEL=debug pnpm start` |

## Development

```bash
pnpm dev             # watch server + Vite at http://127.0.0.1:5173
pnpm dev:mock        # add 6 mock agents across 4 worktrees
pnpm typecheck && pnpm lint && pnpm test
pnpm build:preview   # serverless build with an in-browser simulator
```

Use `?gallery` to preview skin states or `?mock` for the browser simulator.

| Directory | Contents |
| --- | --- |
| `packages/shared` | Types, schemas, and rules |
| `apps/server` | Events, state, WebSocket, and skins |
| `apps/web` | React UI |
| `scripts` | Hooks, skin importer, and diagnostics |

### Adding another agent

1. Implement `Adapter` in `apps/server/src/adapters/<agent>.ts`: `{ kind; normalize(raw: unknown): AgentEvent | null }`. Validate with zod, ignore unsupported input, and never throw. Use `summarizeTool()` / `safeLabel()` for safe summaries.
2. Add its `AgentKind` and UI badge if needed (`codex` already exists).
3. Register it in `apps/server/src/main.ts` and send events through `emit.sh <kind>` (`X-Agent-Kind`).
4. Test supported events and malformed payloads.

The Codex example uses CLI `notify` in `~/.codex/config.toml` for `agent-turn-complete`. A wrapper adds session/workdir metadata and forwards JSON to `emit.sh codex`; the adapter maps completion to `stop`. Check current Codex docs before adding tool or approval states.

## Limitations

- Long tool calls emit no intermediate hooks, so agents may become stale or disappear until the next event.
- Subagent tools appear on the parent worker, labelled `(subagent …)`.
- Restarting the server clears the office until new events arrive.

## Uninstall

```bash
pnpm uninstall-hooks    # preview and remove only Agent Office hooks
rm -rf ~/.agent-office  # remove token and personal skins
```

Settings writes first create `settings.json.bak-<timestamp>` backups and may reformat indentation without changing other settings. Delete backups when satisfied, then delete the project folder.