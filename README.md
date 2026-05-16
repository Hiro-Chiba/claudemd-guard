# agent-gate

[![CI](https://github.com/Hiro-Chiba/agent-gate/actions/workflows/ci.yml/badge.svg)](https://github.com/Hiro-Chiba/agent-gate/actions/workflows/ci.yml)

AI-powered CLAUDE.md enforcer for Claude Code.

---

Prevents Claude Code from forgetting CLAUDE.md rules during long sessions caused by context compression. AI validates every tool operation against your project rules and blocks violations.

## Features

- Deterministic safety baseline that fires before any AI call (recursive rm on catastrophic paths, writes to secret files, force push to protected branches)
- AI validation of CLAUDE.md rules (block mode)
- Uses Claude CLI by default (no additional API key required)
- Anthropic API direct call also supported
- Automatic CLAUDE.md collection (upward + downward directory walk)
- Optional cooldown between AI validations

## Requirements

- Node.js >= 22.0.0
- Claude Code (CLI) installed

## Installation

```bash
git clone https://github.com/Hiro-Chiba/agent-gate.git
cd agent-gate
./install.sh
```

The install script handles dependency install, build, and hook registration. Restart Claude Code to activate.

To remove the hook, run `./uninstall.sh` from the same directory.

## Configuration

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `AGENT_GATE_MODEL` | `claude-sonnet-4-6` | Model used for validation |
| `AGENT_GATE_API_KEY` | — | Anthropic API key (uses API directly when set) |
| `AGENT_GATE_COOLDOWN` | `0` | Cooldown in seconds (0 = validate every time) |
| `AGENT_GATE_DISABLED` | `false` | Disable the whole tool |
| `AGENT_GATE_DISABLED_RULES` | — | Comma-separated rule ids to disable, merged with the config file |
| `USE_SYSTEM_CLAUDE` | `false` | `true` forces PATH claude (default: `~/.claude/local/claude`, falls back to PATH if not found) |

### Project config file: `.agent-gate.json`

Place an `.agent-gate.json` in the project root (or any parent directory) to customize the deterministic baseline.

```json
{
  "disabled_rules": ["prevent-force-push-main"],
  "protected_branches": ["main", "release"],
  "extra_secret_paths": ["vault/", "secrets/"]
}
```

| Field | Effect |
|---|---|
| `disabled_rules` | List of rule ids that will not run. Merged with `AGENT_GATE_DISABLED_RULES`. |
| `protected_branches` | Overrides the default list used by `prevent-force-push-main`. |
| `extra_secret_paths` | Additional path substrings treated as secret targets by `prevent-secret-file-write` (alongside the built-in list). |

## How It Works

1. Claude Code attempts to run `Edit`/`Write`/`Bash`, and the PreToolUse hook fires.
2. Deterministic safety rules run first. Catastrophic patterns (`rm -rf /`, writes to `.env` or `.ssh/*`, `git push --force` on `main`, etc.) are blocked here without calling AI.
3. If the safety baseline passes, agent-gate collects `CLAUDE.md` files from the project.
4. AI validates the operation against those rules.
5. Violation found, operation blocked. No violation, operation proceeds.

## Built-in Safety Rules

These run by default with no configuration required.

| Rule | Blocks |
|---|---|
| `prevent-rm-rf-root` | Recursive `rm` on `/`, `$HOME`, `~`, `/etc`, `/usr`, `/var`, and other catastrophic paths. Handles `sudo` prefix and flag variants (`-rf`, `-fr`, `-Rf`). |
| `prevent-secret-file-write` | `Edit`/`Write` on `.env*` (non-template), `.ssh/*`, `.aws/credentials`, `*.pem`, `*.key`, `id_rsa`, `.netrc`, etc. |
| `prevent-bash-secret-write` | Shell redirects to the same secret paths via `>`, `>>`, or `tee`. Catches `echo X > .env`, `cat > ~/.ssh/id_rsa`. |
| `prevent-force-push-main` | `git push --force` or `-f` to `main`, `master`, `develop`, `production`, `release`, `stable`. Allows `--force-with-lease`. |
| `prevent-system-path-write` | `Edit`/`Write` to `/etc`, `/usr`, `/var`, `/System`, `/Library`, `/opt`, and other system-owned paths. |

## Network Access

agent-gate only communicates with Anthropic endpoints, either directly via the Anthropic API (when `AGENT_GATE_API_KEY` is set) or indirectly through the Claude CLI subprocess. It does not contact any other external services, and it does not send telemetry.

## License

[MIT](LICENSE)
