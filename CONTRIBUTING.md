# Contributing to claudemd-guard

Thanks for your interest in improving claudemd-guard! This document describes how to set up the project locally, the conventions we follow, and how to propose changes.

## Development Setup

Requirements:

- Node.js >= 22.0.0
- npm (bundled with Node)

Clone and install:

```bash
git clone https://github.com/Hiro-Chiba/claudemd-guard.git
cd claudemd-guard
npm install
```

Common commands:

```bash
npm run build      # Build TypeScript to dist/
npm test           # Run the full vitest suite
npm run typecheck  # Type-check without emitting
npm run checks     # typecheck + test
```

Every change should keep `npm run checks` green before you open a pull request.

## Project Structure

```
src/
├── cli/              # CLI entry + install/uninstall subcommands
├── config/           # Environment variable parsing
├── hooks/            # PreToolUse orchestration
├── collector/        # CLAUDE.md discovery (upward + downward walk)
├── validation/       # AI validation
│   ├── models/       # ClaudeCli, AnthropicApi
│   └── prompts/      # System prompt, context assembly, response format
└── contracts/        # Types and Zod schemas
```

See [docs/architecture.md](docs/architecture.md) for a deeper architectural overview.

## Design Principles

claudemd-guard is modeled on the tdd-guard architecture and shares these principles:

- **Interface-driven**: boundaries (for example, AI clients) go through interfaces such as `IModelClient` so that alternatives can be swapped in.
- **Dependency injection**: modules accept collaborators via constructor or function parameters to keep them testable.
- **Fail-open**: when validation cannot complete (JSON parse error, AI timeout, subprocess failure), the hook allows the operation to proceed rather than blocking Claude Code.

Please preserve these properties when adding new modules.

## Coding Conventions

- TypeScript strict mode is on. Do not add `any` unless there is a concrete reason.
- Keep side effects (filesystem, network, subprocess) at the edges. Core logic should be pure where possible.
- Add tests for any new behavior. Prefer unit tests with injected dependencies over integration tests.
- Avoid introducing new runtime dependencies unless they provide substantial value.

## Commit Guidelines

- **Atomic commits**: one logical change per commit.
- **Conventional Commits**: use one of `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `ci`, `perf` as the prefix.

Examples:

```
feat(cli): add --version subcommand
fix(collector): handle symlink loops safely
docs(readme): document npm installation
```

## Pull Request Workflow

1. Fork the repository and create a feature branch from `main`.
2. Make your change and add tests.
3. Run `npm run checks` and make sure it passes.
4. Open a pull request describing **what** changed and **why**. Link any related issues.
5. CI will run automatically. Pull requests cannot be merged until CI is green.
6. Once approved, the pull request will be merged. Merged branches are deleted automatically.

## Reporting Issues

- For bugs, please use the Bug Report issue template and include reproduction steps, expected vs actual behavior, and environment details.
- For feature ideas, please use the Feature Request template and describe the motivation before proposing a specific design.
- For security issues, **do not** open a public issue. See [SECURITY.md](SECURITY.md).

## Code of Conduct

Participation in this project is governed by the [Code of Conduct](CODE_OF_CONDUCT.md). By contributing, you agree to abide by its terms.
