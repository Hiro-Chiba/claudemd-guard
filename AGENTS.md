# claudemd-guard

## Overview

Claude Code の PreToolUse フックを使い、CLAUDE.md の内容をコンテキストに再注入するツール。

## Docs

- [設計書](docs/architecture.md)

## Rules

- シェルスクリプトのみで実装（外部ランタイム不要）
- jq はインストール/アンインストール時のみ使用（メインスクリプトでは不要）
- POSIX互換よりbash前提（macOS/Linux対応）
