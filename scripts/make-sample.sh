#!/usr/bin/env bash
# Regenerates docs/sample/ from a public repository so the README never prints a number
# that came from somewhere else. Run from the repository root after `npm run build`.
# It uses the build in dist/, through a shim called `workproof`, and a fresh clone.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/workproof-sample.XXXXXX")"
KEY=9dc900a6227a1faaaa17d774565afbf3
AUTHOR="Colin Francis"
mkdir -p "$WORK/bin"
printf '#!/bin/sh\nexec node "%s/dist/src/cli.js" "$@"\n' "$ROOT" > "$WORK/bin/workproof"
chmod +x "$WORK/bin/workproof"
export PATH="$WORK/bin:$PATH"
git clone --quiet https://github.com/langchain-ai/openwiki.git "$WORK/openwiki"
git -C "$WORK/openwiki" checkout --quiet 1e6d54c
cd "$WORK/openwiki"
{
  echo "\$ npx workproof --author \"$AUTHOR\" --sample 5 --fingerprint-key $KEY"
  workproof --author "$AUTHOR" --sample 5 --fingerprint-key "$KEY" 2>&1
  echo
  echo "\$ npx workproof check workproof-report.json"
  workproof check workproof-report.json 2>&1
  echo
  echo "\$ npx workproof verify workproof-report.json --fingerprint-key $KEY"
  workproof verify workproof-report.json --fingerprint-key "$KEY" 2>&1
} > "$WORK/transcript.txt"
mkdir -p "$ROOT/docs/sample"
cp workproof-report.json "$ROOT/docs/sample/openwiki-report.json"
cp workproof-report.md "$ROOT/docs/sample/openwiki-report.md"
cp "$WORK/transcript.txt" "$ROOT/docs/sample/transcript.txt"
echo "wrote docs/sample/ from openwiki at $(git rev-parse --short HEAD) (clone in $WORK)"
