# Reddit Post Draft (r/ClaudeAI) - English

**Subreddit:** r/ClaudeAI

**Flair:** (select appropriate flair at post time, e.g. "Built with Claude")

## Title

I built a tool that stops Claude Code from ignoring your CLAUDE.md rules during long sessions

## Body

If you use Claude Code with CLAUDE.md files, you've probably noticed that Claude starts ignoring your rules in longer sessions — context compression quietly drops the constraints you set up.

I had rules like "always create a branch before making changes" and "don't touch certain protected files," but Claude would still violate them after enough back-and-forth. So I built a PreToolUse hook that intercepts file operations and validates them against your rules before they execute.

It works, but one tradeoff is that every tool call triggers an extra AI call for validation, which adds token usage and latency. Has anyone found a better way to enforce CLAUDE.md rules? I'd love to hear other approaches.

**My approach — claudemd-guard:**

1. Claude Code tries to run a tool (Edit/Write/Bash)
2. The PreToolUse hook fires
3. claudemd-guard collects CLAUDE.md files from the project tree
4. A separate Claude call validates the operation against your rules
5. Violation? Blocked. No violation? Passes through.

- Uses Claude CLI by default, so no extra API key needed
- Fail-open design: if the guard errors out, your operation still goes through
- Optional cooldown to control validation frequency

Free and open source (MIT license).

GitHub: https://github.com/Hiro-Chiba/claudemd-guard
