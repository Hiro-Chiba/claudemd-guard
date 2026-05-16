# agent-gate

[![CI](https://github.com/Hiro-Chiba/agent-gate/actions/workflows/ci.yml/badge.svg)](https://github.com/Hiro-Chiba/agent-gate/actions/workflows/ci.yml)

One natural-language rule source, enforced at runtime across multiple AI coding tools.

agent-gate reads the instruction files you already have (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.cursor/rules/*.mdc`, `.clinerules`, `.windsurf/rules`, `.github/copilot-instructions.md`, `CONVENTIONS.md`) as a single combined rule set, then enforces them at hook time in Claude Code and Cursor. A deterministic safety baseline catches catastrophic operations before any AI call.

## Why

The AI coding tool landscape in 2026 has fragmented into many tools, each with its own instruction file format. Existing tooling either syncs rule files across tools (rulesync, symlinks) or enforces a single rule format at runtime (probity, tdd-guard), but not both. agent-gate sits in the gap: it accepts whatever natural-language instruction files you already maintain and enforces them across multiple AI tools through a single hook.

Two pain points the project is built to address:

- **Rule forgetting** in long agent sessions, where context compression drops the rules from the prompt and the agent quietly drifts off-spec.
- **Destructive operations** like `rm -rf $HOME` or force-pushing main, which AI judgment is too unreliable to catch consistently.

## Features

- Multi-source rule collection across 8 instruction file formats, surfaced to AI with per-source attribution.
- Adapter pattern: same binary works in Claude Code (`--agent claude-code`, default) and Cursor 1.7 (`--agent cursor`).
- Deterministic safety baseline with five built-in rules that fire before any AI call.
- AI validation against the combined rule set when the safety baseline passes.
- Per-rule disable and per-project customization via `.agent-gate.json` and `AGENT_GATE_DISABLED_RULES`.
- Optional decision log (`AGENT_GATE_LOG=1`) and `agent-gate stats` for auditing.
- Block reasons are guidance, not denials: the AI is instructed to describe the next correct step alongside the violated rule.

## Requirements

- Node.js >= 22.0.0
- Claude Code or Cursor 1.7

## Installation

```bash
git clone https://github.com/Hiro-Chiba/agent-gate.git
cd agent-gate
./install.sh
```

The install script handles dependency install, build, and Claude Code hook registration. Restart Claude Code to activate.

To register against Cursor instead of Claude Code, run the binary with `--agent cursor` from your Cursor hook config. To remove the Claude Code hook, run `./uninstall.sh`.

## Configuration

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `AGENT_GATE_MODEL` | `claude-sonnet-4-6` | Model used for AI validation |
| `AGENT_GATE_API_KEY` | (none) | Anthropic API key. Uses the API directly when set; otherwise spawns the Claude CLI |
| `AGENT_GATE_COOLDOWN` | `0` | Cooldown in seconds between AI validations (deterministic rules always fire) |
| `AGENT_GATE_DISABLED` | `false` | Set to `true` to disable the whole tool |
| `AGENT_GATE_DISABLED_RULES` | (none) | Comma-separated rule ids to disable, merged with the config file |
| `AGENT_GATE_LOG` | (none) | Set to `1` to append decisions to `~/.agent-gate/log.jsonl` |
| `AGENT_GATE_REASON_LANG` | `auto` | Language for AI-generated `reason` text. `auto` matches the instruction files (English fallback when mixed). Pass `en`, `ja`, `zh`, `ko`, etc. to force a specific language |
| `USE_SYSTEM_CLAUDE` | `false` | `true` forces PATH `claude` (default: `~/.claude/local/claude` with PATH fallback) |

### Project config file

agent-gate looks for either a TypeScript / JavaScript config or a legacy JSON config, walking upward from the cwd until it finds one. Precedence (highest wins): `.agent-gate.config.ts` > `.mts` > `.mjs` > `.cjs` > `.js` > `.agent-gate.json`.

#### TypeScript / JavaScript config

The full API including custom rules:

```ts
// .agent-gate.config.ts
import { defineConfig, forbidCommandPattern, forbidFilePathPattern } from 'agent-gate'

export default defineConfig({
  disabledRules: ['prevent-force-push-main'],
  protectedBranches: ['main', 'release'],
  extraSecretPathPrefixes: ['vault/', 'secrets/'],
  customRules: [
    forbidCommandPattern({
      id: 'no-drop-table',
      match: /drop\s+table/i,
      reason: 'DROP TABLE is forbidden. Use a migration instead.',
    }),
    forbidFilePathPattern({
      id: 'no-prod-config',
      match: /production\.ya?ml$/,
      reason: 'Production config edits go through ops review.',
    }),
  ],
})
```

| Field | Effect |
|---|---|
| `disabledRules` | List of rule ids that will not run. Merged with `AGENT_GATE_DISABLED_RULES`. |
| `protectedBranches` | Overrides the default list used by `prevent-force-push-main`. |
| `extraSecretPathPrefixes` | Additional path substrings treated as secret targets by `prevent-secret-file-write`. |
| `customRules` | User-defined `DeterministicRule[]` appended after the built-ins. Use the `forbidCommandPattern` / `forbidContentPattern` / `forbidFilePathPattern` factories or hand-write your own. |

#### Legacy JSON config

Still works for simple cases:

```json
{
  "disabled_rules": ["prevent-force-push-main"],
  "protected_branches": ["main", "release"],
  "extra_secret_paths": ["vault/", "secrets/"]
}
```

JSON cannot express custom rules. Migrate to the TS/JS form when you need them.

## How It Works

1. The AI coding tool fires a pre-tool-use hook with its vendor-specific JSON payload.
2. The selected adapter parses that payload into a normalized `Action`.
3. Deterministic safety rules run first. Catastrophic patterns are blocked here without calling AI.
4. If the safety baseline passes, agent-gate collects all 8 instruction file formats present in the project tree.
5. The AI validates the operation against the combined rule set, with each source attributed by kind.
6. The verdict (block + guidance, or allow) is returned through the adapter's response formatter.

## Built-in Safety Rules

| Rule | Blocks |
|---|---|
| `prevent-rm-rf-root` | Recursive `rm` on `/`, `$HOME`, `~`, `/etc`, `/usr`, `/var`, and other catastrophic paths. Handles `sudo` prefix and flag variants (`-rf`, `-fr`, `-Rf`). |
| `prevent-secret-file-write` | `Edit`/`Write` on `.env*` (non-template), `.ssh/*`, `.aws/credentials`, `*.pem`, `*.key`, `id_rsa`, `.netrc`. |
| `prevent-bash-secret-write` | Shell redirects to the same secret paths via `>`, `>>`, or `tee`. |
| `prevent-force-push-main` | `git push --force` or `-f` to `main`, `master`, `develop`, `production`, `release`, `stable`. Allows `--force-with-lease`. |
| `prevent-system-path-write` | `Edit`/`Write` to `/etc`, `/usr`, `/var`, `/System`, `/Library`, `/opt`, and other system-owned paths. |

Each rule can be disabled individually through `.agent-gate.json` or the env var.

## Supported Instruction File Formats

agent-gate aggregates rules from any combination of:

- `CLAUDE.md` (Claude Code)
- `AGENTS.md` (cross-tool spec backed by the Linux Foundation Agentic AI Foundation)
- `.cursorrules` (Cursor legacy)
- `.cursor/rules/*.mdc` (Cursor current)
- `.clinerules/*.md` (Cline)
- `.windsurf/rules/*.md` (Windsurf)
- `.github/copilot-instructions.md` (GitHub Copilot)
- `CONVENTIONS.md` (Aider)

You do not need to choose. Maintain whichever file your team already uses; agent-gate reads them all.

## Supported AI Coding Tools

agent-gate enforces in any tool that exposes a pre-tool-use hook. As of v1:

- Claude Code (mature). `agent-gate --agent claude-code`, the default.
- Cursor 1.7 (beta). `agent-gate --agent cursor`. Payload mapping is best-effort against public docs.

Tools without a hook surface (Copilot, Cline, Aider, Codex web, Replit, Devin) can still benefit from agent-gate as a rule source linter or via downstream sync (rulesync, symlinks), but cannot be enforced at runtime.

## CLAUDE.md Doctor

Run `agent-gate lint` from a project root to audit your instruction files for AI-friendliness. The doctor walks the same 8 file formats the runtime reads, then surfaces:

- **Empty files** that would make the AI think no rules exist.
- **Files with no concrete rules** (no imperatives, no bullets, no numbered items).
- **Ambiguous modifiers** like "where possible", "as needed", "適切に", "なるべく", "可能な限り", "必要に応じて". AI judgment cannot enforce these reliably; the doctor suggests replacing them with a concrete condition or threshold.

```text
$ agent-gate lint
/p/CLAUDE.md
  [warning] no-concrete-rules: No imperatives ...
  [info] ambiguous-modifier (line 5): Ambiguous modifier "適切に" ...
      > - エラーは適切に扱う

1 finding.
```

Exit code is 1 if any finding has severity `error`, otherwise 0, so the command can run in CI.

## Daemon mode

Each hook invocation normally spawns a fresh Node process (cold start ~300ms). For users that fire hooks at high frequency, agent-gate can run as a long-lived daemon on a Unix socket and let hook invocations reuse the warm process.

```bash
# Terminal 1: start the daemon (foreground; manage with systemd / launchctl / tmux in production).
agent-gate daemon

# Terminal 2 (or in your hook config):
AGENT_GATE_DAEMON=1 agent-gate
```

When `AGENT_GATE_DAEMON=1`, the hook tries the socket first and transparently falls back to direct mode if the daemon is unreachable. Set `AGENT_GATE_SOCKET_PATH` to override the default `$TMPDIR/agent-gate.sock`.

The daemon is opt-in. Users not setting `AGENT_GATE_DAEMON=1` keep the existing one-shot behavior.

## Observability

Set `AGENT_GATE_LOG=1` to append every decision to `~/.agent-gate/log.jsonl`. Each line is a JSON object with timestamp, adapter, tool, decision, reason, source (`deterministic` / `ai`), and `ruleId` when a deterministic rule fired.

Run `agent-gate stats` for a summary: total decisions, block percentage, breakdown by source, adapter, tool, and rule id.

## Network Access

agent-gate only communicates with Anthropic endpoints, either directly via the Anthropic API (when `AGENT_GATE_API_KEY` is set) or indirectly through the Claude CLI subprocess. It does not contact any other external services and does not send telemetry. Deterministic rules run entirely locally.

## License

[MIT](LICENSE)
