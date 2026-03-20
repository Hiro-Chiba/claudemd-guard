# claudemd-guard

Claude Code の長いセッションでコンテキスト圧縮により CLAUDE.md の指示が忘れられる問題を防ぐ PreToolUse フック。

ファイル編集やコマンド実行の前に CLAUDE.md の内容を自動的にコンテキストへ再注入し、プロジェクトルールの遵守を強制する。

## 仕組み

1. Claude Code が `Edit`/`Write`/`Bash` ツールを実行する前にフックが発火
2. カレントディレクトリから上方向に `/` まで遡り、全 CLAUDE.md を収集
3. カレントディレクトリ配下（最大深度3）の CLAUDE.md も収集
4. 収集した内容を Claude Code のコンテキストに注入

クールダウン機構（デフォルト5分）により、頻繁なツール呼び出し時のオーバーヘッドを抑制する。

## インストール

```bash
git clone https://github.com/chibahiroyuki/claudemd-guard.git
cd claudemd-guard
./install.sh
```

`jq` が必要。未インストールの場合:

```bash
brew install jq
```

インストール後、Claude Code を再起動する。

## アンインストール

```bash
./uninstall.sh
```

## 設定

環境変数でカスタマイズ可能:

| 環境変数 | デフォルト | 説明 |
|---|---|---|
| `CLAUDEMD_COOLDOWN` | `300` | クールダウン秒数（0で常時出力） |

## ライセンス

MIT
