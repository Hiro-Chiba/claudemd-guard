# AGENTS.md for agent-gate

This file is read by any AI coding agent working on this repo, including
Claude Code, Cursor, Cline, and Aider. It is the project's vendor-neutral
instruction file, complementing the existing `CLAUDE.md`.

## What this project is

agent-gate is a runtime enforcer for AI coding agent rules. It reads
natural-language instruction files (CLAUDE.md, AGENTS.md, .cursorrules,
.cursor/rules/*.mdc, .clinerules, .windsurf/rules, .github/copilot-instructions.md,
CONVENTIONS.md) as one combined rule set and enforces them at hook time
in Claude Code and Cursor. A deterministic safety baseline catches
catastrophic operations before any AI call.

## Hard rules

These are non-negotiable while modifying this codebase.

- Never weaken the deterministic safety rules to make a test pass. If a
  rule blocks something it should not, narrow the rule by adding an
  explicit allow-case, never by deleting the protection.
- Never commit any file matching `.env`, `.env.*` (other than
  `.env.example`), `*.pem`, `*.key`, or files inside `.ssh/`.
- Never run `npm publish` from a local checkout. Publishing is performed
  exclusively by the GitHub Actions release workflow on a signed `v*`
  tag push (using OIDC + npm provenance). This keeps releases
  reproducible and supply-chain auditable.

## Soft rules (style and approach)

- Strict TDD for every new rule: write a failing test, make it pass with
  the smallest possible change, refactor, commit.
- One logical change per commit. Use Conventional Commits prefixes
  (`feat`, `fix`, `refactor`, `chore`, `docs`, `test`).
- Prefer adding a new deterministic rule over expanding an existing one
  when the concept is distinct; small, single-purpose rules are easier
  to disable per project.
- Keep block reasons guidance-shaped: name the violated rule and the
  next correct step the agent should take. No bare denials.
- Tests live alongside the file they cover: `test/<mirror of src path>`.

## Development workflow

```bash
npm install
npm run checks     # typecheck + vitest
npm run build      # tsc to dist/
npm test           # vitest run
npm run typecheck  # tsc --noEmit
```

Every change should keep `npm run checks` green before being committed.

## Project structure

- `src/adapters/` — vendor-specific hook payload parsing and response
  formatting (Claude Code, Cursor).
- `src/collector/` — multi-source instruction-file aggregator.
- `src/config/` — `Config` (env vars) and `AgentGateConfig`
  (`.agent-gate.json`).
- `src/contracts/` — shared types (`Action`, `RuleSource`,
  `ValidationResult`) and Zod schemas.
- `src/deterministic/` — the safety baseline. `engine.ts` runs rules
  in order, `rules/*` are individual rules, `defaultRules.ts` exports
  the curated default list.
- `src/hooks/processHookData.ts` — pipeline orchestrator.
- `src/observability/` — decision logger and stats aggregator.
- `src/validation/` — AI client interface, model implementations
  (`ClaudeCli`, `AnthropicApi`), prompt templates.

## When in doubt

Read `docs/architecture.md` (kept locally, gitignored) for the v1
roadmap and design rationale. Otherwise, prefer the smallest change
that keeps `npm run checks` green and ship it.
