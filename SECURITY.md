# Security Policy

## Reporting a Vulnerability

Please do not open a public issue for security problems. Instead, open a private [GitHub Security Advisory](https://github.com/Hiro-Chiba/agent-gate/security/advisories/new) on this repository.

Include as much of the following as you can:

- A clear description of the issue.
- Steps to reproduce or a minimal proof of concept.
- The affected version (`agent-gate --version`).
- Any relevant environment details (Node.js version, OS, validation backend).
- Your assessment of the impact.

You should receive an initial acknowledgement within 7 days. I aim to investigate and respond with a remediation plan within 30 days. Coordinated disclosure is preferred. Please allow reasonable time for a fix to ship before public disclosure.

## Supported Versions

Only the latest published version on npm receives fixes. Please upgrade before filing a report.

## Scope

In-scope:

- The `agent-gate` CLI and hook logic.
- The install / uninstall flow that modifies `~/.claude/settings.json`.
- The deterministic rule engine and built-in safety rules.
- Dependency handling in this repository.

Out-of-scope:

- Vulnerabilities in Claude Code itself, the Claude CLI, Cursor, or the Anthropic API. Please report those to the respective vendors.
- User-controlled instruction file content. By design, agent-gate trusts the project's own CLAUDE.md, AGENTS.md, and similar rule files.
- Issues that require an attacker to already have write access to the user's filesystem.
