#!/usr/bin/env bash
# Records docs/demo.gif from docs/demo.tape on a fresh clone of a public repository.
# Run from the repository root after `npm run build`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/workproof-demo.XXXXXX")"
mkdir -p "$WORK/bin"
printf '#!/bin/sh\nexec node "%s/dist/src/cli.js" "$@"\n' "$ROOT" > "$WORK/bin/workproof"
chmod +x "$WORK/bin/workproof"
git clone --quiet https://github.com/langchain-ai/openwiki.git "$WORK/openwiki"
git -C "$WORK/openwiki" checkout --quiet 1e6d54c
cd "$ROOT"
DEMO_BIN="$WORK/bin" DEMO_REPO="$WORK/openwiki" /opt/homebrew/bin/vhs docs/demo.tape
ls -l docs/demo.gif
