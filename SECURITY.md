# Security Policy

## Supported Versions

Only the latest published version of claudemd-guard receives fixes. Please upgrade before filing a report.

| Version | Supported |
| ------- | --------- |
| latest  | yes       |
| older   | no        |

## Reporting a Vulnerability

Please do **not** open a public issue for security problems. Instead, open a private [GitHub Security Advisory](https://github.com/Hiro-Chiba/claudemd-guard/security/advisories/new) on this repository.

Include as much of the following as you can:

- A clear description of the issue
- Steps to reproduce, or a minimal proof of concept
- The affected version (`claudemd-guard --version`)
- Any relevant environment details (Node.js version, OS, validation backend)
- Your assessment of the impact

## Response Expectations

- You should receive an initial acknowledgement within 7 days.
- We aim to investigate and respond with a remediation plan within 30 days of acknowledgement.
- Coordinated disclosure is preferred. Please give us reasonable time to ship a fix before public disclosure.

## Scope

In-scope:

- The claudemd-guard CLI and hook logic
- The install / uninstall flow that modifies `~/.claude/settings.json`
- Dependency handling in this repository

Out-of-scope:

- Vulnerabilities in Claude Code itself, the Claude CLI, or the Anthropic API (please report those to Anthropic directly)
- User-controlled CLAUDE.md content (by design, claudemd-guard trusts the project's own CLAUDE.md files)
- Issues that require an attacker to already have write access to the user's filesystem
