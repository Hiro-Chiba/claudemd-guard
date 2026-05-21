# agent-gate

[![CI](https://github.com/Hiro-Chiba/agent-gate/actions/workflows/ci.yml/badge.svg)](https://github.com/Hiro-Chiba/agent-gate/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@hiro-c/agent-gate)](https://www.npmjs.com/package/@hiro-c/agent-gate)
[![npm downloads](https://img.shields.io/npm/dt/@hiro-c/agent-gate)](https://www.npmjs.com/package/@hiro-c/agent-gate)
[![license](https://img.shields.io/npm/l/@hiro-c/agent-gate)](LICENSE)

**Runtime rule enforcer for AI coding agents.** Reads your existing instruction files (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`, ...) and enforces them at hook time in Claude Code, Gemini CLI, and Cursor.

## What it does

- **Stops catastrophic operations** before AI ever sees them: `rm -rf /`, writes to `.env` / `.ssh/*`, force-push to `main`, edits to `/etc`. (Supports `Bash`, `Write`, `Edit` in Claude Code; `run_shell_command`, `write_file`, `replace` in Gemini CLI).
- **Aggregates 8 instruction file formats** into one rule set the AI uses to decide on the remaining cases.
- **Returns guidance, not denials**: block reasons describe the next correct step the agent should take.

## Install

### Claude Code
```bash
npm install -g @hiro-c/agent-gate
agent-gate install
```

`agent-gate install` registers the Claude Code PreToolUse hook in `~/.claude/settings.json`. Restart Claude Code to activate. Use `agent-gate uninstall` to remove.

### Gemini CLI
Use the `agent-gate-wrapper` in your project or point your hook config at:
```bash
agent-gate --agent gemini-cli
```

### Cursor
For Cursor 1.7, point your hook config at `agent-gate --agent cursor`.

## How it works

Every `Edit` / `Write` / `Bash` (or `replace` / `write_file` / `run_shell_command`) call from the agent goes through:

```
hook payload → adapter → deterministic rules → AI validation → verdict
                            (5 built-ins)        (your rules)
```

If a deterministic rule fires, AI is skipped. Otherwise agent-gate reads all instruction files in the project tree and asks the AI to validate the operation against them.

## What gets sent to the model

When agent-gate reaches the AI validation step, the prompt sent to the model contains:

- The full text of every instruction file collected by the rule loader (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.cursor/rules/*.mdc`, `.clinerules/*.md`, `.windsurf/rules/*.md`, `.github/copilot-instructions.md`, `CONVENTIONS.md`). No filtering or redaction is applied.
- The tool name and tool input being validated. For `Bash` that is the literal command, for `Edit` / `Write` it is the file path and the proposed new content.

Source files in the project (other than the instruction files above) are **not** read or sent. Operations blocked by a deterministic rule never reach the model at all.

The endpoint depends on which model client is selected. The default fallback chain is `AgentSdkClient` (when `AGENT_GATE_USE_SDK=1`), then `AnthropicApi` (when `AGENT_GATE_API_KEY` is set), then `ClaudeCli` (always available as a final fallback).

- `ClaudeCli` pipes the prompt to your local `claude` binary on stdin. It talks to Anthropic's API under your logged-in account.
- `AnthropicApi` sends the prompt directly to Anthropic's API using `AGENT_GATE_API_KEY`.
- `AgentSdkClient` sends the prompt through `@anthropic-ai/claude-agent-sdk`, reusing the host agent's existing Claude authentication. No separate API key is required.

If your instruction files contain personal or proprietary content (names, email addresses, internal URLs, business strategy notes, and the like), that text leaves your machine every time an operation passes the deterministic baseline and reaches AI validation. Keep sensitive material out of instruction files if that is a concern. To halt all model calls entirely, set `AGENT_GATE_DISABLED=true`.

## Built-in safety rules

Run by default, disable per-rule in `.agent-gate.json` if needed.

| Rule | Blocks |
|---|---|
| `prevent-rm-rf-root` | `rm -rf` on `/`, `$HOME`, `~`, `/etc`, `/usr`, `/var`, etc. (handles `sudo`, flag variants). |
| `prevent-secret-file-read` | `read_file` / `read_many_files` / `Read` to `.env*`, `.ssh/*`, `.aws/credentials`, `*.pem`, `*.key`. |
| `prevent-secret-file-write` | `Edit`/`Write`/`write_file`/`replace` to `.env*`, `.ssh/*`, `.aws/credentials`, `*.pem`, `*.key`. |
| `prevent-bash-secret-write` | Shell redirects to the same paths (`echo > .env`, `tee .ssh/id_rsa`). |
| `prevent-force-push-main` | `git push --force` to `main`, `master`, `develop`, `release`, etc. Allows `--force-with-lease`. |
| `prevent-system-path-write` | `Edit`/`Write`/`write_file`/`replace` to `/etc`, `/usr`, `/System`, `/Library`. |

**Note on `prevent-secret-file-read`:** the default Claude Code hook matcher registered by `agent-gate install` is `Edit|Write|Bash`, so `Read` calls bypass agent-gate entirely and this rule never fires under Claude Code's default install. To enforce it under Claude Code, edit `~/.claude/settings.json` and add `Read` to the matcher on the agent-gate `PreToolUse` entry. Gemini CLI and Cursor route their read tools through agent-gate automatically, so the rule is active there out of the box.

## Config

agent-gate is strictly opt-in: without an `.agent-gate.config.*` file in the project tree, the hook is registered but skips every check. A warning is printed to stderr explaining how to enable it (throttled to once per hour per project root); set `AGENT_GATE_NO_CONFIG_WARNING=1` to silence, or `AGENT_GATE_NO_CONFIG_WARNING_TTL_SEC=<seconds>` to change the throttle window.

Drop a `.agent-gate.config.ts` (or `.js` / `.json`) at the project root:

```ts
import { defineConfig, forbidCommandPattern } from '@hiro-c/agent-gate'

export default defineConfig({
  disabledRules: ['prevent-force-push-main'],
  protectedBranches: ['main', 'release'],
  customRules: [
    forbidCommandPattern({
      id: 'no-drop-table',
      match: /drop\s+table/i,
      reason: 'DROP TABLE is forbidden. Use a migration.',
    }),
  ],
})
```

Full options: see [docs/config.md](docs/config.md) (TODO) or `AgentGatePluginConfig` in the source.

## CLI

| Command | What it does |
|---|---|
| `agent-gate` | Run as hook (reads stdin, used internally) |
| `agent-gate install` / `uninstall` | Register or remove the Claude Code hook |
| `agent-gate daemon` | Long-lived server on a Unix socket (opt-in speedup, set `AGENT_GATE_DAEMON=1`) |

## Environment

| Var | Effect |
|---|---|
| `AGENT_GATE_DISABLED` | Set to `true` to skip all checks |
| `AGENT_GATE_DISABLED_RULES` | Comma-separated rule ids to skip |
| `AGENT_GATE_NO_CONFIG_WARNING` | `1` silences the stderr warning emitted when no `.agent-gate.config.*` is found |
| `AGENT_GATE_NO_CONFIG_WARNING_TTL_SEC` | Throttle window for the above warning, in seconds (default `3600`) |
| `AGENT_GATE_MODEL` | Validation model (default: `claude-sonnet-4-6`) |
| `AGENT_GATE_API_KEY` | Use Anthropic API directly instead of the `claude` CLI |
| `AGENT_GATE_USE_SDK` | `1` prefers the Anthropic agent SDK over API/CLI (no API key needed; works best with daemon mode) |
| `USE_SYSTEM_CLAUDE` | Set to `true` to force the PATH `claude` binary instead of `~/.claude/local/claude` |
| `AGENT_GATE_REASON_LANG` | AI reason language: `auto` (default) / `en` / `ja` / etc. |
| `AGENT_GATE_ON_ERROR` | `block` to fail-closed when a rule or AI client throws (default `allow`) |
| `AGENT_GATE_COOLDOWN` | Cooldown in seconds between AI validations (default `0`) |
| `AGENT_GATE_LOG` | `1` writes decisions to `~/.agent-gate/log.jsonl` |
| `AGENT_GATE_DAEMON` | `1` routes through the daemon if it is running |
| `AGENT_GATE_SOCKET_PATH` | Daemon socket path (default: `$TMPDIR/agent-gate.sock`) |
| `AGENT_GATE_CACHE_TTL_SEC` | Daemon decision cache TTL in seconds (default `60`) |
| `AGENT_GATE_CACHE_SIZE` | Daemon decision cache max entries (default `256`) |

## Supported AI tools

- **Claude Code** (mature, default).
- **Gemini CLI** (supported, `--agent gemini-cli`). Transcript history is opportunistic: Gemini CLI's hook currently passes an empty `transcript_path` ([issue #14715](https://github.com/google-gemini/gemini-cli/issues/14715)), so history is empty until upstream lands. The adapter is forward-compatible with the planned JSONL schema ([issue #15292](https://github.com/google-gemini/gemini-cli/issues/15292)) and the legacy JSON-array form.
- **Cursor 1.7** (beta, `--agent cursor`; payload mapping is best-effort against public docs).

Other tools (Copilot, Cline, Aider, Codex web, Replit, Devin) lack a hook surface and cannot be enforced at runtime.

## License

[MIT](LICENSE)
