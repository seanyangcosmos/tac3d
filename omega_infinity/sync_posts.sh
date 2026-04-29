#!/usr/bin/env bash
set -e

cd "$HOME/.openclaw/workspace/omega_infinity"

echo "[sync] updating posts..."

git add -A

git commit -m "update topology posts $(date +%F)" || true

git push origin HEAD

echo "[sync] done"

