# claudemd-guard

## Project Goal

CLAUDE.mdのルールをAIで検証し、違反するツール操作をブロックするClaude Codeフック。
長時間セッションでのコンテキスト圧縮によるルール忘れを防ぐ。

## Development Workflow

### Commands

```bash
npm run build    # TypeScriptビルド
npm test         # 全テスト実行
npm run checks   # 型チェック + テスト
```

### Commit Guidelines

- Atomic commits: 1つの論理変更に1コミット
- Conventional format: feat, fix, refactor, test, chore, docs

## Project Structure

```
src/
├── cli/              # CLIエントリポイント（stdin→処理→stdout）
├── config/           # 環境変数・設定管理
├── hooks/            # フックイベント分岐・メイン処理
├── collector/        # CLAUDE.md収集（上方向+下方向探索）
├── validation/       # AI検証
│   ├── models/       # ClaudeCli, AnthropicApi
│   └── prompts/      # プロンプトテンプレート
└── contracts/        # 型定義・Zodスキーマ
```

### Key Design Principles

- Interface-driven: IModelClientでモデルクライアントを抽象化
- Dependency injection: テスト時にモック注入可能
- Fail-open: エラー時はブロックせず通す
