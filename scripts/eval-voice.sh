#!/usr/bin/env bash
# pnpm eval:voice [-- --llm] [--pack <id>]: runs the voice eval with the given
# arguments, then formats the report (pnpm would append arguments to the last
# command of a chained script, so the chain lives here).
set -euo pipefail
cd "$(dirname "$0")/.."
status=0
bash scripts/voice.sh run python -m healwyn_voice.eval "$@" || status=$?
pnpm exec prettier --write --log-level warn docs/VOICE_EVAL.md
exit "$status"
