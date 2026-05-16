#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_ENTRY="${SCRIPT_DIR}/dist/cli/claudegate.js"

echo "=== claudegate uninstaller (git-clone mode) ==="
echo ""
echo "Note: if you installed via 'npm install -g claudegate',"
echo "you can run 'claudegate uninstall' directly instead of this script."
echo ""

if [[ ! -f "$DIST_ENTRY" ]]; then
  echo "ERROR: ${DIST_ENTRY} not found. Run ./install.sh first, or use 'claudegate uninstall' if installed globally."
  exit 1
fi

node "$DIST_ENTRY" uninstall
