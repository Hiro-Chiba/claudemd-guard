#!/usr/bin/env bash
set -euo pipefail

SETTINGS_FILE="${HOME}/.claude/settings.json"

echo "=== claudemd-guard v2 uninstaller ==="

# Remove hook entries from settings.json
if [[ -f "$SETTINGS_FILE" ]]; then
  echo "Removing hook from settings.json..."

  node -e "
const fs = require('fs');
const settingsPath = '${SETTINGS_FILE}';

const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));

if (settings.hooks && settings.hooks.PreToolUse) {
  settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(entry => {
    if (!entry.hooks) return true;
    return !entry.hooks.some(h => h.command && h.command.includes('claudemd-guard'));
  });

  // Clean up empty arrays
  if (settings.hooks.PreToolUse.length === 0) {
    delete settings.hooks.PreToolUse;
  }
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }
}

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
"

  echo "Hook removed from settings.json."
else
  echo "No settings.json found — nothing to clean up."
fi

echo ""
echo "Done! claudemd-guard v2 uninstalled."
echo "Restart Claude Code to deactivate."
