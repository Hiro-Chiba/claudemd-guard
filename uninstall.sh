#!/usr/bin/env bash
# Uninstall claudemd-guard hook from Claude Code settings
set -euo pipefail

HOOKS_DIR="$HOME/.claude/hooks"
SETTINGS_FILE="$HOME/.claude/settings.json"
HOOK_NAME="claudemd-guard.sh"

echo "=== claudemd-guard uninstaller ==="

# 1. Remove symlink
if [[ -L "$HOOKS_DIR/$HOOK_NAME" ]]; then
  rm "$HOOKS_DIR/$HOOK_NAME"
  echo "Removed symlink: $HOOKS_DIR/$HOOK_NAME"
elif [[ -f "$HOOKS_DIR/$HOOK_NAME" ]]; then
  rm "$HOOKS_DIR/$HOOK_NAME"
  echo "Removed file: $HOOKS_DIR/$HOOK_NAME"
else
  echo "Hook script not found at $HOOKS_DIR/$HOOK_NAME"
fi

# 2. Remove from settings.json
if ! command -v jq &>/dev/null; then
  echo "Warning: jq not found. Please manually remove claudemd-guard from $SETTINGS_FILE"
  exit 0
fi

if [[ -f "$SETTINGS_FILE" ]]; then
  UPDATED=$(jq '
    if .hooks.PreToolUse then
      .hooks.PreToolUse |= map(select(.hooks | all(.command | test("claudemd-guard") | not)))
      | if .hooks.PreToolUse == [] then del(.hooks.PreToolUse) else . end
      | if .hooks == {} then del(.hooks) else . end
    else . end
  ' "$SETTINGS_FILE")

  printf '%s\n' "$UPDATED" > "$SETTINGS_FILE"
  echo "Removed hook from $SETTINGS_FILE"
else
  echo "Settings file not found at $SETTINGS_FILE"
fi

# 3. Clean up cooldown stamps
rm -f /tmp/claudemd-guard-* 2>/dev/null && echo "Cleaned up cooldown stamps" || true

echo ""
echo "Uninstall complete."
