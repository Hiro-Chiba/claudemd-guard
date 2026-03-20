#!/usr/bin/env bash
# claudemd-guard - Re-inject CLAUDE.md contents into Claude Code context
# via PreToolUse hook to prevent instruction drift during long sessions.
set -euo pipefail

# --- Configuration ---
COOLDOWN="${CLAUDEMD_COOLDOWN:-300}"  # seconds (default: 5 min)
EXCLUDED_DIRS="node_modules|\.git|target|\.venv|vendor|__pycache__|dist|build"
MAX_DEPTH=3

# --- Read stdin (hook protocol requires consuming it) ---
cat > /dev/null

# --- Cooldown check ---
PWD_HASH=$(printf '%s' "$PWD" | shasum -a 256 | cut -d' ' -f1)
STAMP_FILE="/tmp/claudemd-guard-${PWD_HASH}"
NOW=$(date +%s)

if [[ "$COOLDOWN" -gt 0 && -f "$STAMP_FILE" ]]; then
  LAST=$(cat "$STAMP_FILE" 2>/dev/null || echo 0)
  if (( NOW - LAST < COOLDOWN )); then
    exit 0  # Within cooldown — skip silently
  fi
fi

# --- Collect CLAUDE.md files ---
collected=""

# 1) Walk upward from $PWD to /
dir="$PWD"
while true; do
  if [[ -f "$dir/CLAUDE.md" ]]; then
    collected="${collected}
--- ${dir}/CLAUDE.md ---
$(cat "$dir/CLAUDE.md")
"
  fi
  if [[ "$dir" == "/" ]]; then
    break
  fi
  dir=$(dirname "$dir")
done

# 2) Walk downward from $PWD (max depth, excluding common dirs)
while IFS= read -r -d '' f; do
  # Skip files already found in the upward walk (i.e., $PWD/CLAUDE.md)
  f_dir=$(dirname "$f")
  if [[ "$f_dir" == "$PWD" ]]; then
    continue
  fi
  collected="${collected}
--- ${f} ---
$(cat "$f")
"
done < <(find "$PWD" -maxdepth "$MAX_DEPTH" -name "CLAUDE.md" \
  -not -path "*node_modules*" \
  -not -path "*.git*" \
  -not -path "*target*" \
  -not -path "*.venv*" \
  -not -path "*vendor*" \
  -not -path "*__pycache__*" \
  -not -path "*dist/*" \
  -not -path "*build/*" \
  -print0 2>/dev/null)

# --- Output ---
if [[ -z "$collected" ]]; then
  exit 0  # No CLAUDE.md found
fi

# Update cooldown timestamp
printf '%s' "$NOW" > "$STAMP_FILE"

# Build reason string with reminder header
reason="[claudemd-guard] CLAUDE.md reminder — follow these project rules:
${collected}"

# Escape for JSON: backslash, double-quote, then control chars
reason_escaped=$(printf '%s' "$reason" | sed 's/\\/\\\\/g; s/"/\\"/g' | awk '{printf "%s\\n", $0}' | sed '$ s/\\n$//')

# Output hook response (no decision = informational, not blocking)
printf '{"reason":"%s"}\n' "$reason_escaped"
