#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_ENTRY="${SCRIPT_DIR}/dist/cli/claudemd-guard.js"
SETTINGS_FILE="${HOME}/.claude/settings.json"
HOOK_CMD="node ${DIST_ENTRY}"

echo "=== claudemd-guard v2 installer ==="

# 1. Install dependencies + build
cd "$SCRIPT_DIR"

if [[ ! -d "node_modules" ]]; then
  echo "[1/2] Installing dependencies..."
  npm install --production
fi

if [[ ! -f "$DIST_ENTRY" ]]; then
  echo "[1/2] Building..."
  npm install
  npm run build

  if [[ ! -f "$DIST_ENTRY" ]]; then
    echo "ERROR: Build failed — ${DIST_ENTRY} not found"
    exit 1
  fi
else
  echo "[1/2] dist/ found, skipping build."
fi

# 2. Update settings.json
echo "[2/2] Updating Claude Code settings..."

mkdir -p "$(dirname "$SETTINGS_FILE")"

if [[ ! -f "$SETTINGS_FILE" ]]; then
  echo '{}' > "$SETTINGS_FILE"
fi

# Use node to safely merge the hook config into settings.json
node -e "
const fs = require('fs');
const settingsPath = '${SETTINGS_FILE}';
const hookCmd = '${HOOK_CMD}';

const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));

if (!settings.hooks) settings.hooks = {};
if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];

// Remove any existing claudemd-guard entries
settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(entry => {
  if (!entry.hooks) return true;
  return !entry.hooks.some(h => h.command && h.command.includes('claudemd-guard'));
});

// Add new entry
settings.hooks.PreToolUse.push({
  matcher: 'Edit|Write|Bash',
  hooks: [
    {
      type: 'command',
      command: hookCmd
    }
  ]
});

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
"

echo ""
echo "Done! claudemd-guard v2 installed."
echo "Restart Claude Code to activate."
