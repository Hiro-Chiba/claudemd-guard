# claudegate

[![CI](https://github.com/Hiro-Chiba/claudegate/actions/workflows/ci.yml/badge.svg)](https://github.com/Hiro-Chiba/claudegate/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/claudegate.svg)](https://www.npmjs.com/package/claudegate)
[![License: MIT](https://img.shields.io/npm/l/claudegate.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/claudegate.svg)](package.json)

AI-powered CLAUDE.md enforcer for Claude Code.

English | [日本語](README_ja.md) | [Architecture](docs/architecture.md)

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

```bash
npm install -g claudegate
claudegate install
```

Restart Claude Code to activate. To remove, run `claudegate uninstall`.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `CLAUDEGATE_MODEL` | `claude-sonnet-4-6` | Model used for validation |
| `CLAUDEGATE_API_KEY` | — | Anthropic API key (uses API directly when set) |
| `CLAUDEGATE_COOLDOWN` | `0` | Cooldown in seconds (0 = validate every time) |
| `CLAUDEGATE_DISABLED` | `false` | Disable flag |
| `USE_SYSTEM_CLAUDE` | `false` | `true` forces PATH claude (default: ~/.claude/local/claude, falls back to PATH if not found) |

## How It Works

1. Claude Code attempts to run `Edit`/`Write`/`Bash` — PreToolUse hook fires
2. claudegate collects CLAUDE.md files from the project
3. AI checks the tool operation against the rules
4. Violation found — operation blocked. No violation — operation proceeds.

## Network Access

claudegate only communicates with Anthropic endpoints — either directly via the Anthropic API (when `CLAUDEGATE_API_KEY` is set) or indirectly through the Claude CLI subprocess. It does not contact any other external services, and it does not send telemetry.

## Contributing

Contributions are welcome. Please see [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding conventions, and the pull request workflow.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the release history.

## License

[MIT](LICENSE)
