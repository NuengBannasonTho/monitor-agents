# Agent Office

A local, read-only monitor for the AI coding agents you run in
Orca. Every Claude Code session becomes a little pixel worker:
busy agents head into a pixel city and sit at its computer desks, waiting agents stroll around a
forest glade, and the face (or costume) shows what each one is doing right now.

It does not modify Orca and never talks to the internet. Claude Code hooks send events to a
small server on `127.0.0.1`, which pushes them to the page over a WebSocket.

```
Claude Code ──hook──▶ scripts/emit.sh ──POST /events──▶ server (127.0.0.1:4777) ──/ws──▶ browser
               async      curl, 0.3 s max                 adapter → reducer → coalescer
```

## Requirements

- macOS or Linux (the hook relay is a POSIX shell script; Windows is untested, use WSL)
- Node.js 22.12 or newer, pnpm 10 or newer, `curl`
- Claude Code with hooks (verified with 2.1.318)

## Quick start

```bash
pnpm install
pnpm start              # builds the web app and serves it at http://127.0.0.1:4777
```

In a second terminal:

```bash
pnpm install-hooks      # shows the settings.json diff and asks before writing
pnpm diagnose           # checks every link and walks a test agent through the office
```

Open http://127.0.0.1:4777, then start or continue Claude Code sessions in your Orca worktrees.
Sessions started **after** installing the hooks report to the office; restart any that were
already open.

Keep `pnpm start` running while you work (a spare terminal tab or `tmux` pane is enough).

## Using the office

| State     | Where  | Shown as                                    | Comes from                          |
| --------- | ------ | ------------------------------------------- | ----------------------------------- |
| idle      | forest | walks around                                | session start, 3 s after done       |
| called    | city   | raised eyebrows / ninja                     | you sent a prompt                   |
| reading   | city   | holds a document / astronaut                | Read, Grep, Glob                    |
| running   | city   | terminal above the head / fire              | Bash                                |
| working   | city   | focused, typing / mech                      | any other tool (Edit, Write, Agent) |
| needs-you | city   | worried, red "!" / crying; header turns red | permission or input request         |
| done      | forest | happy / king                                | the turn finished                   |
| stale     | forest | asleep, faded / zombie                      | no events for 5 min                 |

In the city each agent gets a computer desk; its monitor shows code in the state's color and
flashes a red "!" when the agent needs you.

- The header counts agents per state; **Needs you** turns red when anyone is waiting on you.
- Click a worker for its detail panel: agent kind, desk (worktree), folder, session, and the last
  20 activity lines. Click another worker to switch; click again or press Escape to close.
- **Sound** (off by default) plays a short chime when an agent starts waiting on you. Turn it on
  with a click, since browsers only allow sound after you interact with the page.
- Light and dark follow your system theme: day in the light theme, night (lit windows, campfire
  glow, fireflies) in the dark one. Reduced motion turns off walking, bobbing and scene animation.

## Skins (your own characters)

Skins are image packs in `~/.agent-office/skins/<pack>/`, outside the repo, so personal images
are never committed. With a pack installed, the header shows:

- **Pixel**: built-in pixel workers.
- **By task**: the costume shows what the agent is doing (one image per state).
- **By desk**: each worktree keeps one costume, picked in the detail panel and remembered in the
  browser. States in `stateOverrides` (e.g. crying for needs-you) still switch.

To make a pack, put the images (any size, plain light background) in a folder with a `skin.json`
like [skins/example.skin.json](skins/example.skin.json), then:

```bash
pnpm skins:import ./my-skin-folder              # → ~/.agent-office/skins/<name>/
pnpm skins:import ./my-skin-folder --size 48 --pack my-crew
```

The importer removes the background, crops every image with the same box (characters do not jump
when they change state), downsamples to a square pixel grid (64 by default) and reduces the
palette. Reload the page to pick up a new pack.

## Configuration

Environment variables for `pnpm start`:

| Variable                     | Default           | Meaning                                              |
| ---------------------------- | ----------------- | ---------------------------------------------------- |
| `PORT`                       | `4777`            | Server port (also set `AGENT_OFFICE_PORT` for hooks) |
| `STALE_AFTER_MIN`            | `5`               | Silence before an agent is shown as stale            |
| `REMOVE_AFTER_MIN`           | `10`              | Silence before an agent is removed                   |
| `NEEDS_YOU_REMOVE_AFTER_MIN` | `60`              | Agents waiting on you stay this long instead         |
| `LOG_LEVEL`                  | `info`            | `debug` logs every event and every dropped one       |
| `AGENT_OFFICE_HOME`          | `~/.agent-office` | Token and skin packs                                 |

`emit.sh` reads `AGENT_OFFICE_HOME` and `AGENT_OFFICE_PORT`. `install-hooks` honours
`CLAUDE_CONFIG_DIR` and accepts `--settings <path>`, `--dry-run` and `--yes`.

## Privacy and security

- The server binds to `127.0.0.1` only, makes no outbound calls, sends no telemetry, and keeps
  state in memory (a restart clears the office).
- `POST /events` requires the token from `~/.agent-office/token` (0600). `emit.sh` passes it from a
  0600 header file, so it never appears in the process list.
- The WebSocket only accepts the app's own Origin, and every route rejects unexpected `Host`
  headers (DNS-rebinding guard).
- Prompts, full tool input and assistant messages are never stored or shown. Activity lines keep
  only the tool name and a short target (relative path, search pattern, or the first 80 characters
  of a command), with anything that looks like a secret replaced by `[REDACTED]`.

## Uninstall

```bash
pnpm uninstall-hooks    # removes only Agent Office's entries, after showing the diff
rm -rf ~/.agent-office  # token and skin packs
```

Every write to `settings.json` first saves `settings.json.bak-<timestamp>` next to it; delete those
backups once you are happy. Then delete this folder.

## Troubleshooting

Run `pnpm diagnose` first. It checks Node, curl, `emit.sh`, the token files, the server and the
hooks, then sends a test agent through the real hook path.

| Symptom                                 | Fix                                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| Header says **OFFLINE**                 | The server is not running: `pnpm start`. The page reconnects by itself.                 |
| Office stays empty                      | Hooks only apply to sessions started after `pnpm install-hooks`; restart the session.   |
| Diagnose: hooks point to another copy   | You moved the repo. Run `pnpm install-hooks` again; it updates the path.                |
| An agent vanished during a long command | No hook fires while one tool runs. Raise `STALE_AFTER_MIN` / `REMOVE_AFTER_MIN`.        |
| Port 4777 is taken                      | `PORT=4800 pnpm start` and `export AGENT_OFFICE_PORT=4800` where Claude Code runs.      |
| install-hooks: "not valid JSON"         | Fix `~/.claude/settings.json` by hand (or restore a `.bak-` file); nothing was changed. |
| Skin switcher missing                   | No valid pack in `~/.agent-office/skins`; check the server log for "invalid skin pack". |
| Want to see why an event was ignored    | `LOG_LEVEL=debug pnpm start`                                                            |

`install-hooks` rewrites `settings.json` with consistent indentation, so compact one-line entries
you already had may be re-indented. Their content does not change, and the diff shows it before
anything is written.

## Development

```bash
pnpm dev          # server (watch) + Vite at http://127.0.0.1:5173
pnpm dev:mock     # same, plus 6 fake agents across 4 worktrees (permission prompts, subagents)
pnpm typecheck && pnpm lint && pnpm test
pnpm build:preview  # server-less build that runs an in-browser simulator
```

`?gallery` shows every state in the current skin; `?mock` runs the in-browser simulator.

```
packages/shared   domain types + zod schemas, zone rules, skin manifest
apps/server       Fastify: /events, adapters, pure reducer + sweeper, store, coalescer, /ws, skins
apps/web          Vite + React + motion + Animate UI primitives (Radix flavour), CSS modules
scripts           emit.sh, install/uninstall hooks, skin importer, diagnose
```

## Adding an adapter for another agent

An adapter turns one agent's raw payload into the shared `AgentEvent`; everything after it
(reducer, sweeper, UI) is agent-agnostic.

1. Create `apps/server/src/adapters/<agent>.ts` implementing `Adapter`
   (`{ kind; normalize(raw: unknown): AgentEvent | null }`). Validate with zod, keep only the
   fields you need, return `null` for anything you do not understand, and never throw. Build
   summaries with `summarizeTool()` / `safeLabel()` so redaction and truncation stay consistent.
2. Use a kind from `AgentKind` in `packages/shared/src/domain.ts` (`codex` already exists; add a
   new one there if needed, plus a badge in `apps/web/src/components/office/kind.ts`).
3. Register it in `apps/server/src/main.ts`: `adapters: [createClaudeCodeAdapter(), createCodexAdapter()]`.
4. Send its events with the matching header: `emit.sh <kind>` sets `X-Agent-Kind`.
5. Add tests next to the adapter for every event type and for malformed input.

**Codex example.** At the time of writing Codex CLI exposes a `notify` program in
`~/.codex/config.toml` (`notify = ["/path/to/codex-notify.sh"]`). It receives one JSON argument
and only fires on `agent-turn-complete`, without a session id or working directory. A wrapper can
add those before handing the payload to `emit.sh`:

```sh
#!/bin/sh
# codex-notify.sh: Codex passes the event as $1, emit.sh reads stdin.
printf '{"session":"codex-%s","cwd":"%s","event":%s}' "$PPID" "$PWD" "$1" \
  | /path/to/agent-office/scripts/emit.sh codex
```

The adapter then maps `event.type === "agent-turn-complete"` to `{ type: 'stop' }`, which is
enough to show Codex agents finishing turns. Richer states (tools, approvals) need richer events
from Codex; check its current docs before building more.

## Known limitations

- While a single tool call runs (for example a 15-minute test suite) no hook fires, so the agent
  can turn stale or be removed; it reappears on its next event.
- Subagents share their parent's session, so their tool calls appear on the parent worker,
  labelled "(subagent …)".
- State lives in memory: restarting the server empties the office until agents send new events.
