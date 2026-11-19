#!/usr/bin/env bash
# Run a command with isolated CI credentials, then remove them on exit.
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "Usage: bash .sandcastle/with-codex-auth.sh <command> [args...]" >&2
  exit 1
fi
if [ -z "${CODEX_API_KEY:-}" ] && [ -z "${CODEX_AUTH_JSON:-}" ]; then
  echo "Set the CODEX_AUTH_JSON or CODEX_API_KEY Actions secret." >&2
  exit 1
fi

umask 077
CODEX_HOME=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/sandcastle-codex.XXXXXX")
export CODEX_HOME
trap 'rm -rf -- "$CODEX_HOME"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
printf '%s\n' 'cli_auth_credentials_store = "file"' > "$CODEX_HOME/config.toml"

# An API key takes precedence if both secrets are configured.
if [ -z "${CODEX_API_KEY:-}" ]; then
  if ! printf '%s' "$CODEX_AUTH_JSON" | jq -e \
    'type == "object" and (.tokens.access_token | type == "string" and length > 0)' \
    > /dev/null 2>&1; then
    echo "CODEX_AUTH_JSON must contain the complete subscription auth.json from codex login." >&2
    exit 1
  fi
  printf '%s' "$CODEX_AUTH_JSON" > "$CODEX_HOME/auth.json"
fi
unset CODEX_AUTH_JSON

"$@"
