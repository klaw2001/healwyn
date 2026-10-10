#!/usr/bin/env bash
# Python tooling for apps/voice, kept in apps/voice/.venv.
#
#   scripts/voice.sh setup            create or refresh the venv (dev tools: pydantic, pytest, ruff, codegen)
#   scripts/voice.sh setup-agent      also install the LiveKit agent runtime (requirements.txt)
#   scripts/voice.sh run <cmd> ...    run a command inside the venv (cwd apps/voice)
#
# Uses uv when available (fast), else python3 -m venv + pip. Reinstalls only
# when a requirements file changes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VOICE="$ROOT/apps/voice"
VENV="$VOICE/.venv"
PY="$VENV/bin/python"

install() {
  local file="$1" stamp="$VENV/.installed-$(basename "$1")"
  local hash
  hash="$(sha256sum "$file" | cut -d' ' -f1)"
  if [[ -f "$stamp" && "$(cat "$stamp")" == "$hash" ]]; then return; fi
  if command -v uv >/dev/null 2>&1; then
    uv pip install --quiet --python "$PY" -r "$file"
  else
    "$PY" -m pip install --quiet -r "$file"
  fi
  echo "$hash" >"$stamp"
}

ensure_venv() {
  if [[ ! -x "$PY" ]]; then
    if command -v uv >/dev/null 2>&1; then
      uv venv --quiet "$VENV"
    else
      python3 -m venv "$VENV"
    fi
  fi
  install "$VOICE/requirements-dev.txt"
}

case "${1:-}" in
  setup) ensure_venv ;;
  setup-agent) ensure_venv && install "$VOICE/requirements.txt" ;;
  run)
    shift
    ensure_venv
    cd "$VOICE"
    PATH="$VENV/bin:$PATH" exec "$@"
    ;;
  *)
    echo "usage: scripts/voice.sh setup|setup-agent|run <command…>" >&2
    exit 2
    ;;
esac
