# アーキテクチャ

## 概要

claudemd-guard v2 は Claude Code の PreToolUse フックとして動作する TypeScript アプリケーション。
`Edit`/`Write`/`Bash` ツール実行前に発火し、CLAUDE.md のルールに対して AI 検証を行い、
違反操作をブロックする。

## フック動作フロー

```
Claude Code (Edit/Write/Bash)
  ↓ PreToolUse event
  ↓ stdin: JSON (hook_event_name, tool_name, tool_input)
claudemd-guard
  1. stdin から JSON パース
  2. PreToolUse 以外はスキップ
  3. クールダウンチェック（オプション）
  4. CLAUDE.md 収集（上方向 + 下方向探索）
  5. AI にルール + ツール操作を送信
  6. AI レスポンス解析 → block or pass
  7. stdout: JSON {"decision": "block"|null, "reason": "..."}
  ↓
Claude Code（block なら操作を中止、null なら続行）
```

## CLAUDE.md 収集ロジック

### 上方向探索
`$PWD` から `/` まで各ディレクトリの CLAUDE.md を収集。

### 下方向探索
`$PWD` 配下を最大深度3まで再帰探索。以下を除外:
- node_modules, .git, target, .venv, vendor, __pycache__, dist, build

## AI 検証

### モデルクライアント優先順位
1. **Claude CLI（デフォルト）**: `~/.claude/local/claude` → 存在しなければPATH上の `claude` を子プロセスで実行。APIキー不要
2. **Anthropic API**: `CLAUDEMD_GUARD_API_KEY` が設定されていれば直接API呼び出し

### システムプロンプト
- 明確なルール違反のみブロック
- 曖昧な場合は通す（過剰ブロック防止）
- ルールに書かれていないことは違反ではない

### レスポンスフォーマット
```json
{"decision": "block" | null, "reason": "..."}
```

## 環境変数

| 変数名 | デフォルト | 説明 |
|---|---|---|
| `CLAUDEMD_GUARD_MODEL` | `claude-sonnet-4-6` | 検証モデル |
| `CLAUDEMD_GUARD_API_KEY` | — | Anthropic APIキー |
| `CLAUDEMD_GUARD_COOLDOWN` | `0` | クールダウン秒数 |
| `CLAUDEMD_GUARD_DISABLED` | `false` | 無効化フラグ |
| `USE_SYSTEM_CLAUDE` | `false` | `true`でPATH上のclaudeを強制使用（デフォルトは~/.claude/local/claude → PATHフォールバック） |

## インストール構成

```
~/.claude/settings.json に PreToolUse フック設定を追加
→ node /path/to/claudemd-guard/dist/cli/claudemd-guard.js
```
