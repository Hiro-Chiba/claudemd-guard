#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_ENTRY="${SCRIPT_DIR}/dist/cli/claudegate.js"

echo "=== claudegate installer (git-clone mode) ==="
echo ""
echo "Note: if you installed via 'npm install -g claudegate',"
echo "you can run 'claudegate install' directly instead of this script."
echo ""

cd "$SCRIPT_DIR"

if [[ ! -d "node_modules" ]]; then
  echo "[1/2] Installing dependencies..."
  npm install
fi

if [[ ! -f "$DIST_ENTRY" ]]; then
  echo "[1/2] Building..."
  npm run build

  if [[ ! -f "$DIST_ENTRY" ]]; then
    echo "ERROR: Build failed — ${DIST_ENTRY} not found"
    exit 1
  fi
else
  echo "[1/2] dist/ found, skipping build."
fi

echo "[2/2] Registering hook via CLI..."
node "$DIST_ENTRY" install
