# アーキテクチャ

## 概要

claudemd-guard v2 は Claude Code の PreToolUse フックとして動作する TypeScript アプリケーション。
`Edit`/`Write`/`Bash` ツール実行前に発火し、CLAUDE.md のルールに対して AI 検証を行い、違反操作をブロックする。

## フック動作フロー

```mermaid
sequenceDiagram
    participant CC as Claude Code
    participant Hook as claudemd-guard
    participant FS as ファイルシステム
    participant AI as AIモデル

    CC->>Hook: PreToolUse イベント (stdin JSON)
    Note over Hook: JSONパース<br/>PreToolUse判定<br/>無効化チェック<br/>クールダウンチェック

    Hook->>FS: CLAUDE.md ファイル収集
    FS-->>Hook: プロジェクトツリーのルール群

    Hook->>AI: ルール + ツール操作
    AI-->>Hook: {"decision": "block"|null, "reason": "..."}

    alt 違反あり
        Hook-->>CC: {"decision": "block", "reason": "..."}
        Note over CC: 操作ブロック
    else 違反なし
        Hook-->>CC: {"reason": "No violation found"}
        Note over CC: 操作続行
    end
```

## モジュール構成

```mermaid
graph TD
    subgraph CLI ["CLIエントリポイント"]
        A[cli/claudemd-guard.ts<br/>stdin → 処理 → stdout]
    end

    subgraph Core ["コア"]
        B[hooks/processHookData.ts<br/>オーケストレーション]
        C[config/Config.ts<br/>環境変数・設定管理]
    end

    subgraph Collector ["収集"]
        D[collector/collectClaudeMd.ts<br/>上方向 + 下方向探索]
    end

    subgraph Validation ["AI検証"]
        E[validation/validator.ts<br/>AI呼び出し + レスポンスパース]
        F[models/ClaudeCli.ts<br/>CLI子プロセス]
        G[models/AnthropicApi.ts<br/>Anthropic SDK]
        H[prompts/*<br/>システムプロンプト, コンテキスト, レスポンス形式]
    end

    subgraph Contracts ["型定義"]
        I[types/ + schemas/<br/>ValidationResult, HookData, Zodスキーマ]
    end

    A --> B
    B --> C
    B --> D
    B --> E
    E --> F
    E --> G
    E --> H
    B --> I
    E --> I
```

## CLAUDE.md 収集ロジック

```mermaid
graph LR
    subgraph Upward ["上方向探索 (pwd → /)"]
        direction TB
        U1["/users/me/project/src"] -->|親| U2["/users/me/project"]
        U2 -->|親| U3["/users/me"]
        U3 -->|親| U4["/users"]
        U4 -->|親| U5["/"]
    end

    subgraph Downward ["下方向探索 (最大深度3)"]
        direction TB
        D1["project/"] --> D2["src/"]
        D1 --> D3["lib/"]
        D2 --> D4["components/"]
        D1 ~~~ D5["node_modules/ ✗"]
        D1 ~~~ D6[".git/ ✗"]
    end

    Upward -->|重複排除| R[統合された CLAUDE.md ファイル群]
    Downward -->|重複排除| R
```

## モデルクライアント選択

```mermaid
flowchart TD
    Start[開始] --> CheckAPI{CLAUDEMD_GUARD_API_KEY<br/>設定済み?}
    CheckAPI -->|Yes| API[AnthropicApi<br/>API直接呼び出し]
    CheckAPI -->|No| CheckSystem{USE_SYSTEM_CLAUDE<br/>= true?}
    CheckSystem -->|Yes| PATH[PATH上の claude]
    CheckSystem -->|No| CheckLocal{~/.claude/local/claude<br/>存在する?}
    CheckLocal -->|Yes| Local[~/.claude/local/claude]
    CheckLocal -->|No| PATH
```

## 早期リターン条件

```mermaid
flowchart TD
    Input[stdin JSON] --> Parse{有効なJSON?}
    Parse -->|No| Pass1[通過]
    Parse -->|Yes| Event{PreToolUse?}
    Event -->|No| Pass2[通過]
    Event -->|Yes| Disabled{無効化?}
    Disabled -->|Yes| Pass3[通過]
    Disabled -->|No| Tool{tool_name +<br/>tool_input<br/>あり?}
    Tool -->|No| Pass4[通過]
    Tool -->|Yes| Cooldown{クールダウン<br/>期間内?}
    Cooldown -->|Yes| Pass5[通過]
    Cooldown -->|No| Collect{CLAUDE.md<br/>見つかった?}
    Collect -->|No| Pass6[通過]
    Collect -->|Yes| Validate[AI検証]
    Validate --> Result{判定結果?}
    Result -->|block| Block[ブロック]
    Result -->|null| Pass7[通過]

    style Block fill:#f66,color:#fff
    style Pass1 fill:#6c6,color:#fff
    style Pass2 fill:#6c6,color:#fff
    style Pass3 fill:#6c6,color:#fff
    style Pass4 fill:#6c6,color:#fff
    style Pass5 fill:#6c6,color:#fff
    style Pass6 fill:#6c6,color:#fff
    style Pass7 fill:#6c6,color:#fff
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
~/.claude/settings.json
└── hooks.PreToolUse[]
    └── matcher: "Edit|Write|Bash"
        └── command: "node /path/to/claudemd-guard/dist/cli/claudemd-guard.js"
```
