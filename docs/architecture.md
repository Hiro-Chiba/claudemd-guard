# アーキテクチャ

## 概要

claudemd-guard は Claude Code の PreToolUse フックとして動作するシェルスクリプト。
`Edit`/`Write`/`Bash` ツール実行前に発火し、CLAUDE.md の内容をコンテキストに再注入する。

## フック動作フロー

```
Claude Code (Edit/Write/Bash)
  ↓ PreToolUse event
  ↓ stdin: JSON (tool_name, tool_input, etc.)
claudemd-guard.sh
  1. stdin 消費（プロトコル準拠）
  2. クールダウンチェック（/tmp/claudemd-guard-<hash>）
  3. CLAUDE.md 収集（上方向 + 下方向）
  4. stdout: JSON {"reason": "..."} でコンテキスト注入
  ↓
Claude Code（reason の内容がコンテキストに追加される）
```

## CLAUDE.md 収集ロジック

### 上方向探索
`$PWD` から `/` まで各ディレクトリの CLAUDE.md を収集。

### 下方向探索
`$PWD` 配下を `find` で最大深度3まで探索。以下を除外:
- node_modules, .git, target, .venv, vendor, __pycache__, dist, build

## クールダウン機構

- `/tmp/claudemd-guard-<PWD の SHA256 ハッシュ>` にタイムスタンプ保存
- PWD ごとに独立管理
- デフォルト 300秒（`CLAUDEMD_COOLDOWN` 環境変数で変更可能）
- `CLAUDEMD_COOLDOWN=0` で無効化（常時出力）

## フック出力フォーマット

```json
{"reason": "[claudemd-guard] CLAUDE.md reminder — follow these project rules:\n--- /path/CLAUDE.md ---\n(内容)"}
```

`decision` フィールドなし = 情報提供のみ（ブロックしない）。

## インストール構成

```
~/.claude/
├── hooks/
│   └── claudemd-guard.sh → (symlink to repo)
└── settings.json  ← PreToolUse フック設定を追加
```
