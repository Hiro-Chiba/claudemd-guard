# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-04-19

First public release on npm. Reflects the TypeScript implementation and subcommand-based install flow.

### Added

- npm distribution via `npm install -g claudemd-guard`
- CLI subcommands: `install`, `uninstall`, `--help`, `--version`
- `ClaudeCli` test coverage (binary resolution, argument construction, response parsing)
- `installer` module with unit tests (12 cases)
- Absolute path resolution for the hook command, avoiding PATH dependency on Claude Code hook invocation
- `prepublishOnly` script to prevent publishing a broken build
- Dependabot configuration for npm and GitHub Actions updates
- Release workflow that publishes to npm on `v*` tag push
- Contribution guide, Code of Conduct, Security policy, pull request and issue templates
- README badges for CI status, npm version, license, and required Node version
- Build step in CI to catch broken `dist/` output before merge

### Changed

- Install flow moved from `install.sh` shell script to the TypeScript `install` subcommand; the shell scripts are now thin wrappers that delegate to the CLI
- README files (EN/JA) updated to describe the npm-based installation path
- Hook command written to `~/.claude/settings.json` now uses `node <absolute-realpath>` regardless of how the installer was invoked

### Removed

- Personal hobby convention files (`AGENTS.md`, Reddit post drafts) from tracked sources
