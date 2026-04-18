# claudemd-guard

[![CI](https://github.com/Hiro-Chiba/claudemd-guard/actions/workflows/ci.yml/badge.svg)](https://github.com/Hiro-Chiba/claudemd-guard/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/claudemd-guard.svg)](https://www.npmjs.com/package/claudemd-guard)
[![License: MIT](https://img.shields.io/npm/l/claudemd-guard.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/claudemd-guard.svg)](package.json)

AI-powered CLAUDE.md enforcer for Claude Code.

English | [日本語](README_ja.md) | [Architecture](docs/architecture.md) | [Releases on npm](https://www.npmjs.com/package/claudemd-guard)

---

Prevents Claude Code from forgetting CLAUDE.md rules during long sessions caused by context compression. AI validates every tool operation against your project rules and blocks violations.

## Features

- AI validation of CLAUDE.md rules (block mode)
- Uses Claude CLI by default (no additional API key required)
- Anthropic API direct call also supported
- Automatic CLAUDE.md collection (upward + downward directory walk)
- Optional cooldown between validations

## Requirements

- Node.js >= 22.0.0
- Claude Code (CLI) installed

## Installation

Via npm (recommended):

```bash
npm install -g claudemd-guard
claudemd-guard install
```

Or via git clone:

```bash
git clone https://github.com/Hiro-Chiba/claudemd-guard.git
cd claudemd-guard
./install.sh
```

Restart Claude Code to activate.

## Uninstallation

```bash
claudemd-guard uninstall
# or, if installed via git clone:
./uninstall.sh
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `CLAUDEMD_GUARD_MODEL` | `claude-sonnet-4-6` | Model used for validation |
| `CLAUDEMD_GUARD_API_KEY` | — | Anthropic API key (uses API directly when set) |
| `CLAUDEMD_GUARD_COOLDOWN` | `0` | Cooldown in seconds (0 = validate every time) |
| `CLAUDEMD_GUARD_DISABLED` | `false` | Disable flag |
| `USE_SYSTEM_CLAUDE` | `false` | `true` forces PATH claude (default: ~/.claude/local/claude, falls back to PATH if not found) |

## How It Works

1. Claude Code attempts to run `Edit`/`Write`/`Bash` — PreToolUse hook fires
2. claudemd-guard collects CLAUDE.md files from the project
3. AI checks the tool operation against the rules
4. Violation found — operation blocked. No violation — operation proceeds.

## Contributing

Contributions are welcome. Please see [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding conventions, and the pull request workflow.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the release history.

## License

[MIT](LICENSE)
