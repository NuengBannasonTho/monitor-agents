#!/bin/sh
# Agent Office hook relay: forwards one Claude Code hook payload (stdin) to the
# local Agent Office server. Installed by `pnpm install-hooks` as an async hook.
#
# Contract: never slow down or fail the agent.
#   - prints nothing (stdout of some hooks is added to the agent's context)
#   - gives up after 0.3 s, including when the server is not running
#   - always exits 0
#
# The token is passed to curl from a 0600 header file, so it never appears in
# the process list. Usage: emit.sh [agent-kind]   (default: claude-code)

HOME_DIR="${AGENT_OFFICE_HOME:-$HOME/.agent-office}"
HEADERS="$HOME_DIR/curl-headers"
PORT="${AGENT_OFFICE_PORT:-4777}"
KIND="${1:-claude-code}"

if [ ! -r "$HEADERS" ] || ! command -v curl >/dev/null 2>&1; then
  cat >/dev/null 2>&1 # drain stdin so the writer never blocks
  exit 0
fi

curl -s -m 0.3 --connect-timeout 0.2 -o /dev/null \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Agent-Kind: $KIND" \
  -H "@$HEADERS" \
  --data-binary @- \
  "http://127.0.0.1:$PORT/events" >/dev/null 2>&1 || true

exit 0
