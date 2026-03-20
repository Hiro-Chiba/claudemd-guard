# claudemd-guard

AI-powered CLAUDE.md enforcer for Claude Code.

[English](#english) | [日本語](#日本語)

---

## English

Prevents Claude Code from forgetting CLAUDE.md rules during long sessions caused by context compression. AI validates every tool operation against your project rules and blocks violations.

### Features

- AI validation of CLAUDE.md rules (block mode)
- Uses Claude CLI by default (no additional API key required)
- Anthropic API direct call also supported
- Automatic CLAUDE.md collection (upward + downward directory walk)
- Optional cooldown between validations

### Requirements

- Node.js >= 22.0.0
- Claude Code (CLI) installed

### Installation

```bash
git clone https://github.com/Hiro-Chiba/claudemd-guard.git
cd claudemd-guard
./install.sh
```

Restart Claude Code to activate.

### Uninstallation

```bash
./uninstall.sh
```

### Configuration

| Variable | Default | Description |
|---|---|---|
| `CLAUDEMD_GUARD_MODEL` | `claude-sonnet-4-6` | Model used for validation |
| `CLAUDEMD_GUARD_API_KEY` | — | Anthropic API key (uses API directly when set) |
| `CLAUDEMD_GUARD_COOLDOWN` | `0` | Cooldown in seconds (0 = validate every time) |
| `CLAUDEMD_GUARD_DISABLED` | `false` | Disable flag |
| `USE_SYSTEM_CLAUDE` | `false` | `true` forces PATH claude (default: ~/.claude/local/claude, falls back to PATH if not found) |

### How It Works

1. Claude Code attempts to run `Edit`/`Write`/`Bash` — PreToolUse hook fires
2. claudemd-guard collects CLAUDE.md files from the project
3. AI checks the tool operation against the rules
4. Violation found — operation blocked. No violation — operation proceeds.

### Development

```bash
npm install
npm run build    # Build
npm test         # Run tests
npm run checks   # Typecheck + tests
```

---

## 日本語

Claude Code の長時間セッションで発生するコンテキスト圧縮による CLAUDE.md ルール忘れを防止。AI がツール操作を検証し、ルール違反をブロックします。

### 特徴

- CLAUDE.md ルールの AI 検証（ブロック方式）
- Claude CLI 経由でのAI呼び出し（追加APIキー不要）
- Anthropic API 直接呼び出しも対応
- 上方向 + 下方向の CLAUDE.md 自動収集
- クールダウン機能（オプション）

### 必要環境

- Node.js >= 22.0.0
- Claude Code（CLI）がインストール済み

### インストール

```bash
git clone https://github.com/Hiro-Chiba/claudemd-guard.git
cd claudemd-guard
./install.sh
```

Claude Code を再起動すれば有効になります。

### アンインストール

```bash
./uninstall.sh
```

### 設定

| 変数名 | デフォルト | 説明 |
|---|---|---|
| `CLAUDEMD_GUARD_MODEL` | `claude-sonnet-4-6` | 検証に使用するモデル |
| `CLAUDEMD_GUARD_API_KEY` | — | Anthropic APIキー（設定時はAPI直接呼び出し） |
| `CLAUDEMD_GUARD_COOLDOWN` | `0` | クールダウン秒数（0=毎回検証） |
| `CLAUDEMD_GUARD_DISABLED` | `false` | 無効化フラグ |
| `USE_SYSTEM_CLAUDE` | `false` | `true`でPATH上のclaudeを強制使用（デフォルトは~/.claude/local/claude → 存在しなければPATHにフォールバック） |

### 仕組み

1. Claude Code が `Edit`/`Write`/`Bash` を実行しようとすると PreToolUse フックが発火
2. claudemd-guard がプロジェクト内の CLAUDE.md を収集
3. AI がルールとツール操作を照合して違反判定
4. 違反あり → ブロック（操作中止）、違反なし → 素通し

### 開発

```bash
npm install
npm run build    # ビルド
npm test         # テスト実行
npm run checks   # 型チェック + テスト
```

---

## License

MIT
