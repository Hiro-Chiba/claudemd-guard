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
- **Audits your rule files** with `agent-gate lint` (detects vague rules and ambiguous modifiers like "適切に" / "where possible").

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

## Config

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
| `agent-gate lint [--ai]` | Audit instruction files for ambiguity, emptiness, missing rules. `--ai` adds AI-driven contradiction / ambiguity / missing-imperative checks |
| `agent-gate stats` | Summarize the decision log (after `AGENT_GATE_LOG=1`) |
| `agent-gate suggest` | Surface rule candidates from repeated AI blocks and stale built-in rules |
| `agent-gate daemon` | Long-lived server on a Unix socket (opt-in speedup, set `AGENT_GATE_DAEMON=1`) |

## Environment

| Var | Effect |
|---|---|
| `AGENT_GATE_DISABLED` | Skip all checks |
| `AGENT_GATE_DISABLED_RULES` | Comma-separated rule ids to skip |
| `AGENT_GATE_REASON_LANG` | AI reason language: `auto` (default) / `en` / `ja` / etc. |
| `AGENT_GATE_LOG` | `1` writes decisions to `~/.agent-gate/log.jsonl` |
| `AGENT_GATE_API_KEY` | Use Anthropic API directly instead of `claude` CLI |
| `AGENT_GATE_USE_SDK` | `1` prefers the Anthropic agent SDK over API/CLI (no API key needed; works best with daemon mode) |
| `AGENT_GATE_ON_ERROR` | `block` to fail-closed when a rule or AI client throws (default `allow`) |
| `AGENT_GATE_DAEMON` | `1` routes through the daemon if it is running |
| `AGENT_GATE_CACHE_TTL_SEC` | Daemon decision cache TTL in seconds (default `60`) |
| `AGENT_GATE_CACHE_SIZE` | Daemon decision cache max entries (default `256`) |

## Supported AI tools

- **Claude Code** (mature, default).
- **Gemini CLI** (fully supported, `--agent gemini-cli`; features high-precision transcript parsing).
- **Cursor 1.7** (beta, `--agent cursor`; payload mapping is best-effort against public docs).

Other tools (Copilot, Cline, Aider, Codex web, Replit, Devin) lack a hook surface and cannot be enforced at runtime.

## License

[MIT](LICENSE)
