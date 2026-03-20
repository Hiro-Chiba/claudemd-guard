# claudemd-guard

## Overview

Claude CodeフックでCLAUDE.mdルールをAI検証し、違反操作をブロックするエンフォーサー。

## Docs

- [設計書](docs/architecture.md)

## Rules

- tdd-guardのアーキテクチャに準拠（依存性注入、インターフェース駆動）
- デフォルトはClaude CLI経由でAI呼び出し（APIキー不要）
- エラー時はブロックせず通す（過剰ブロック防止）
