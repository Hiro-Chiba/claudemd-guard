# claudemd-guard

[![CI](https://github.com/Hiro-Chiba/claudemd-guard/actions/workflows/ci.yml/badge.svg)](https://github.com/Hiro-Chiba/claudemd-guard/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/claudemd-guard.svg)](https://www.npmjs.com/package/claudemd-guard)
[![License: MIT](https://img.shields.io/npm/l/claudemd-guard.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/claudemd-guard.svg)](package.json)

Claude Code 用の AI 駆動型 CLAUDE.md エンフォーサー。

[English](README.md) | 日本語 | [アーキテクチャ](docs/architecture_jp.md) | [npm リリース](https://www.npmjs.com/package/claudemd-guard)

---

Claude Code の長時間セッションで発生するコンテキスト圧縮による CLAUDE.md ルール忘れを防止。AI がツール操作を検証し、ルール違反をブロックします。

## 特徴

- CLAUDE.md ルールの AI 検証（ブロック方式）
- Claude CLI 経由でのAI呼び出し（追加APIキー不要）
- Anthropic API 直接呼び出しも対応
- 上方向 + 下方向の CLAUDE.md 自動収集
- クールダウン機能（オプション）

## 必要環境

- Node.js >= 22.0.0
- Claude Code（CLI）がインストール済み

## インストール

npm 経由（推奨）:

```bash
npm install -g claudemd-guard
claudemd-guard install
```

git clone の場合:

```bash
git clone https://github.com/Hiro-Chiba/claudemd-guard.git
cd claudemd-guard
./install.sh
```

Claude Code を再起動すれば有効になります。

## アンインストール

```bash
claudemd-guard uninstall
# git clone でインストールした場合:
./uninstall.sh
```

## 設定

| 変数名 | デフォルト | 説明 |
|---|---|---|
| `CLAUDEMD_GUARD_MODEL` | `claude-sonnet-4-6` | 検証に使用するモデル |
| `CLAUDEMD_GUARD_API_KEY` | — | Anthropic APIキー（設定時はAPI直接呼び出し） |
| `CLAUDEMD_GUARD_COOLDOWN` | `0` | クールダウン秒数（0=毎回検証） |
| `CLAUDEMD_GUARD_DISABLED` | `false` | 無効化フラグ |
| `USE_SYSTEM_CLAUDE` | `false` | `true`でPATH上のclaudeを強制使用（デフォルトは~/.claude/local/claude → 存在しなければPATHにフォールバック） |

## 仕組み

1. Claude Code が `Edit`/`Write`/`Bash` を実行しようとすると PreToolUse フックが発火
2. claudemd-guard がプロジェクト内の CLAUDE.md を収集
3. AI がルールとツール操作を照合して違反判定
4. 違反あり → ブロック（操作中止）、違反なし → 素通し

## 貢献

プルリクエストを歓迎します。開発セットアップ、コーディング規約、PR ワークフローは [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## 更新履歴

リリース履歴は [CHANGELOG.md](CHANGELOG.md) を参照してください。

## ライセンス

[MIT](LICENSE)
