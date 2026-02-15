# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Claude Code plugin that provides GPT (via Codex CLI) and Gemini (via Gemini CLI) as specialized expert subagents. Five domain experts that can advise OR implement: Architect, Plan Reviewer, Scope Analyst, Code Reviewer, and Security Analyst.

## Development Commands

```bash
# Test plugin locally (loads from working directory)
claude --plugin-dir /path/to/claude-delegator

# Run setup to test installation flow
/claude-delegator:setup

# Run uninstall to test removal flow
/claude-delegator:uninstall
```

No build step, no dependencies. Uses native MCP servers from Codex and Gemini CLIs.

## Architecture

### Orchestration Flow

Claude acts as orchestrator—delegates to specialized experts based on task type. Supports both **single-shot** (independent calls) and **multi-turn** (context preserved via `threadId`).

```
User Request → Claude Code → [Match trigger → Select expert & provider]
                                    ↓
              ┌─────────────────────┼─────────────────────┐
              ↓                     ↓                     ↓
         Architect            Code Reviewer        Security Analyst
              ↓                     ↓                     ↓
    [Advisory (read-only) OR Implementation (workspace-write)]
              ↓                     ↓                     ↓
    Claude synthesizes response ←──┴──────────────────────┘
```

### How Delegation Works

1. **Match trigger** - Check `rules/triggers.md` for semantic patterns
2. **Read expert prompt** - Load from `prompts/[expert].md`
3. **Build 7-section prompt** - Use format from `rules/delegation-format.md`
4. **Call provider tool** - `mcp__codex__codex` or `mcp__gemini__gemini`
5. **Synthesize response** - Never show raw output; interpret and verify

### The 7-Section Delegation Format

Every delegation prompt must include: TASK, EXPECTED OUTCOME, CONTEXT, CONSTRAINTS, MUST DO, MUST NOT DO, OUTPUT FORMAT. See `rules/delegation-format.md` for templates.

### Retry Handling

Retries use multi-turn (`*-reply` with `threadId`) so the expert remembers previous attempts:
- Attempt 1 fails → retry with error details (context preserved)
- Up to 3 attempts → then escalate to user
- Fallback: new call with full history if multi-turn unavailable

### Component Relationships

| Component | Purpose | Notes |
|-----------|---------|-------|
| `rules/*.md` | When/how to delegate | Installed to `~/.claude/rules/delegator/` |
| `prompts/*.md` | Expert personalities | Injected via `developer-instructions` |
| `commands/*.md` | Slash commands | `/setup`, `/uninstall` |
| `config/providers.json` | Provider metadata | Not used at runtime |

> Expert prompts adapted from [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)

## Five GPT Experts

| Expert | Prompt | Specialty | Triggers |
|--------|--------|-----------|----------|
| **Architect** | `prompts/architect.md` | System design, tradeoffs | "how should I structure", "tradeoffs of", design questions |
| **Plan Reviewer** | `prompts/plan-reviewer.md` | Plan validation | "review this plan", before significant work |
| **Scope Analyst** | `prompts/scope-analyst.md` | Requirements analysis | "clarify the scope", vague requirements |
| **Code Reviewer** | `prompts/code-reviewer.md` | Code quality, bugs | "review this code", "find issues" |
| **Security Analyst** | `prompts/security-analyst.md` | Vulnerabilities | "is this secure", "harden this" |

Every expert can operate in **advisory** (`sandbox: read-only`) or **implementation** (`sandbox: workspace-write`) mode based on the task.

## Key Design Decisions

1. **Native & Bridge MCP** - Codex has a native `mcp-server` command. Gemini requires an internal bridge (`server/gemini/index.js`) to expose its CLI via MCP.
2. **Single-shot + multi-turn** - Single-shot for advisory (full context per call), multi-turn via `threadId` for chained implementation and retries
3. **Dual mode** - Any expert can advise or implement based on task
4. **Synthesize, don't passthrough** - Claude interprets expert output, applies judgment
5. **Proactive triggers** - Claude checks for delegation triggers on every message

## When NOT to Delegate

- Simple syntax questions (answer directly)
- First attempt at any fix (try yourself first)
- Trivial file operations
- Research/documentation tasks
