#!/usr/bin/env bash
# Install claudemd-guard hook into Claude Code settings
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOKS_DIR="$HOME/.claude/hooks"
SETTINGS_FILE="$HOME/.claude/settings.json"
HOOK_NAME="claudemd-guard.sh"

echo "=== claudemd-guard installer ==="

# 1. Create hooks directory
mkdir -p "$HOOKS_DIR"

# 2. Symlink the hook script
if [[ -L "$HOOKS_DIR/$HOOK_NAME" ]]; then
  echo "Updating existing symlink..."
  rm "$HOOKS_DIR/$HOOK_NAME"
elif [[ -f "$HOOKS_DIR/$HOOK_NAME" ]]; then
  echo "Warning: $HOOKS_DIR/$HOOK_NAME exists as a regular file. Backing up..."
  mv "$HOOKS_DIR/$HOOK_NAME" "$HOOKS_DIR/$HOOK_NAME.bak"
fi

ln -s "$SCRIPT_DIR/$HOOK_NAME" "$HOOKS_DIR/$HOOK_NAME"
echo "Symlinked: $HOOKS_DIR/$HOOK_NAME -> $SCRIPT_DIR/$HOOK_NAME"

# 3. Update settings.json
if ! command -v jq &>/dev/null; then
  echo "Error: jq is required but not installed. Install it with: brew install jq"
  exit 1
fi

# Create settings.json if it doesn't exist
if [[ ! -f "$SETTINGS_FILE" ]]; then
  echo '{}' > "$SETTINGS_FILE"
fi

# Define the hook entry we want to add
HOOK_ENTRY='{
  "matcher": "Edit|Write|Bash",
  "hooks": [
    {
      "type": "command",
      "command": "~/.claude/hooks/claudemd-guard.sh"
    }
  ]
}'

# Check if claudemd-guard is already configured
if jq -e '.hooks.PreToolUse[]? | select(.hooks[]?.command | test("claudemd-guard"))' "$SETTINGS_FILE" &>/dev/null; then
  echo "Hook already configured in settings.json. Skipping."
else
  # Merge into existing settings
  UPDATED=$(jq --argjson entry "$HOOK_ENTRY" '
    .hooks //= {} |
    .hooks.PreToolUse //= [] |
    .hooks.PreToolUse += [$entry]
  ' "$SETTINGS_FILE")

  printf '%s\n' "$UPDATED" > "$SETTINGS_FILE"
  echo "Added PreToolUse hook to $SETTINGS_FILE"
fi

echo ""
echo "Installation complete! Restart Claude Code to activate the hook."
