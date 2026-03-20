# claudemd-guard

## プロジェクトルール

- シェルスクリプト（bash）のみで実装。Node.js/Python 等の外部ランタイムに依存しない
- `jq` は install.sh / uninstall.sh でのみ使用。メインスクリプトでは使わない
- メインスクリプト `claudemd-guard.sh` は副作用を最小限に（/tmp への書き込みのみ）
- Claude Code フックプロトコルに準拠: stdin を消費し、stdout に JSON を出力

## テスト方法

```bash
echo '{}' | CLAUDEMD_COOLDOWN=0 ./claudemd-guard.sh
```
