# Architecture

## Overview

claudemd-guard v2 is a TypeScript application that runs as a Claude Code PreToolUse hook.
It fires before `Edit`/`Write`/`Bash` tool execution, validates the operation against CLAUDE.md rules using AI, and blocks violations.

## Hook Flow

```mermaid
sequenceDiagram
    participant CC as Claude Code
    participant Hook as claudemd-guard
    participant FS as File System
    participant AI as AI Model

    CC->>Hook: PreToolUse event (stdin JSON)
    Note over Hook: Parse JSON<br/>Check: PreToolUse?<br/>Check: disabled?<br/>Check: cooldown?

    Hook->>FS: Collect CLAUDE.md files
    FS-->>Hook: Rules from project tree

    Hook->>AI: Rules + tool operation
    AI-->>Hook: {"decision": "block"|null, "reason": "..."}

    alt Violation detected
        Hook-->>CC: {"decision": "block", "reason": "..."}
        Note over CC: Operation blocked
    else No violation
        Hook-->>CC: {"reason": "No violation found"}
        Note over CC: Operation proceeds
    end
```

## Module Structure

```mermaid
graph TD
    subgraph CLI
        A[cli/claudemd-guard.ts<br/>stdin → process → stdout]
    end

    subgraph Core
        B[hooks/processHookData.ts<br/>Orchestration]
        C[config/Config.ts<br/>Environment variables]
    end

    subgraph Collector
        D[collector/collectClaudeMd.ts<br/>Upward + downward walk]
    end

    subgraph Validation
        E[validation/validator.ts<br/>AI call + response parse]
        F[models/ClaudeCli.ts<br/>CLI subprocess]
        G[models/AnthropicApi.ts<br/>Anthropic SDK]
        H[prompts/*<br/>System prompt, context, response format]
    end

    subgraph Contracts
        I[types/ + schemas/<br/>ValidationResult, HookData, Zod schemas]
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

## CLAUDE.md Collection

```mermaid
graph LR
    subgraph Upward ["Upward Walk (pwd → /)"]
        direction TB
        U1["/users/me/project/src"] -->|parent| U2["/users/me/project"]
        U2 -->|parent| U3["/users/me"]
        U3 -->|parent| U4["/users"]
        U4 -->|parent| U5["/"]
    end

    subgraph Downward ["Downward Walk (max depth 3)"]
        direction TB
        D1["project/"] --> D2["src/"]
        D1 --> D3["lib/"]
        D2 --> D4["components/"]
        D1 ~~~ D5["node_modules/ ✗"]
        D1 ~~~ D6[".git/ ✗"]
    end

    Upward -->|deduplicate| R[Combined CLAUDE.md files]
    Downward -->|deduplicate| R
```

## Model Client Selection

```mermaid
flowchart TD
    Start[Start] --> CheckAPI{CLAUDEMD_GUARD_API_KEY<br/>set?}
    CheckAPI -->|Yes| API[AnthropicApi<br/>Direct API call]
    CheckAPI -->|No| CheckSystem{USE_SYSTEM_CLAUDE<br/>= true?}
    CheckSystem -->|Yes| PATH[claude from PATH]
    CheckSystem -->|No| CheckLocal{~/.claude/local/claude<br/>exists?}
    CheckLocal -->|Yes| Local[~/.claude/local/claude]
    CheckLocal -->|No| PATH
```

## Early Exit Conditions

```mermaid
flowchart TD
    Input[stdin JSON] --> Disabled{Disabled?}
    Disabled -->|Yes| Pass1[PASS]
    Disabled -->|No| Parse{Valid JSON?}
    Parse -->|No| Pass2[PASS]
    Parse -->|Yes| Event{PreToolUse?}
    Event -->|No| Pass3[PASS]
    Event -->|Yes| Tool{tool_name +<br/>tool_input?}
    Tool -->|No| Pass4[PASS]
    Tool -->|Yes| Cooldown{Within<br/>cooldown?}
    Cooldown -->|Yes| Pass5[PASS]
    Cooldown -->|No| Collect{CLAUDE.md<br/>found?}
    Collect -->|No| Pass6[PASS]
    Collect -->|Yes| Validate[AI Validation]
    Validate --> Result{Decision?}
    Result -->|block| Block[BLOCK]
    Result -->|null| Pass7[PASS]

    style Block fill:#f66,color:#fff
    style Pass1 fill:#6c6,color:#fff
    style Pass2 fill:#6c6,color:#fff
    style Pass3 fill:#6c6,color:#fff
    style Pass4 fill:#6c6,color:#fff
    style Pass5 fill:#6c6,color:#fff
    style Pass6 fill:#6c6,color:#fff
    style Pass7 fill:#6c6,color:#fff
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `CLAUDEMD_GUARD_MODEL` | `claude-sonnet-4-6` | Validation model |
| `CLAUDEMD_GUARD_API_KEY` | — | Anthropic API key |
| `CLAUDEMD_GUARD_COOLDOWN` | `0` | Cooldown in seconds |
| `CLAUDEMD_GUARD_DISABLED` | `false` | Disable flag |
| `USE_SYSTEM_CLAUDE` | `false` | `true` forces PATH claude (default: ~/.claude/local/claude with PATH fallback) |

## Installation

```
~/.claude/settings.json
└── hooks.PreToolUse[]
    └── matcher: "Edit|Write|Bash"
        └── command: "node /path/to/claudemd-guard/dist/cli/claudemd-guard.js"
```
