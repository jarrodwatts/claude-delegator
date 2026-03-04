# Multi-Turn Support, Config Defaults, and Model Update — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update claude-delegator to document multi-turn conversations via `codex-reply`, add `config.toml` defaults guidance, fix the setup command to use `claude mcp add` instead of writing `settings.json` directly, and bump model references from gpt-5.2-codex to gpt-5.3-codex.

**Architecture:** Surgical in-place edits to 8 existing files. No new files, no structural changes. Each task is one file or one logical unit of change.

**Tech Stack:** Markdown documentation, JSON config files

---

### Task 1: Update model version in config files

**Files:**
- Modify: `config/providers.json:12`
- Modify: `config/mcp-servers.example.json:6`

**Step 1: Update providers.json**

Replace line 12:
```json
        "args": ["-m", "gpt-5.3-codex", "mcp-server"]
```

**Step 2: Update mcp-servers.example.json**

Replace line 6:
```json
      "args": ["-m", "gpt-5.3-codex", "mcp-server"]
```

**Step 3: Verify JSON is valid**

Run: `python3 -c "import json; json.load(open('config/providers.json')); json.load(open('config/mcp-servers.example.json')); print('OK')"`
Expected: `OK`

**Step 4: Commit**

```bash
git add config/providers.json config/mcp-servers.example.json
git commit -m "chore: bump model from gpt-5.2-codex to gpt-5.3-codex"
```

---

### Task 2: Fix setup command — use `claude mcp add` instead of writing settings.json

**Files:**
- Modify: `commands/setup.md:38-58,66-98`

The current setup writes MCP config directly to `~/.claude/settings.json` (lines 40-51), which is incorrect for Claude Code. The proper way to register MCP servers is via `claude mcp add`.

**Step 1: Replace Step 3 "Configure MCP Server" (lines 38-58)**

Replace the entire Step 3 section with:

```markdown
## Step 3: Configure MCP Server

Register Codex as an MCP server using Claude Code's native command:

```bash
# Re-run safe: replace existing user-scoped entry if present.
claude mcp remove --scope user codex >/dev/null 2>&1 || true
claude mcp add --transport stdio --scope user codex -- codex -m gpt-5.3-codex mcp-server
```

This registers the Codex MCP server at user scope (available across all projects) and avoids "already exists" failures on rerun.

**Note:** To customise Codex behaviour, add CLI flags before `mcp-server`:
- `-s workspace-write` — allow workspace writes with sandboxing
- `-s danger-full-access` — disable sandbox restrictions (trusted/external sandbox only)
- `-c 'model_reasoning_effort="xhigh"'` — set reasoning effort
- Example with all options:
  ```bash
  claude mcp add --transport stdio --scope user codex -- codex -s workspace-write -m gpt-5.3-codex -c 'model_reasoning_effort="xhigh"' mcp-server
  ```
```

**Step 2: Update Step 5 verification checks (lines 66-82)**

Replace the MCP config check (Check 2) with:

```bash
# Check 2: MCP server health
CODEX_CONFIG=$(claude mcp get codex 2>/dev/null || true)
if echo "$CODEX_CONFIG" | grep -q "Status: ✓ Connected"; then
  echo "OK"
elif echo "$CODEX_CONFIG" | grep -q "^codex:"; then
  echo "NOT HEALTHY"
else
  echo "NOT CONFIGURED"
fi
```

**Step 3: Update Step 6 status report (lines 84-97)**

Replace the model line:
```
Model:         ✓ gpt-5.3-codex (or ✗ if not configured)
MCP Config:    ✓ Registered via claude mcp (or ✗ if missing)
```

**Step 4: Also update all remaining gpt-5.2-codex references in setup.md**

Search and replace any remaining `gpt-5.2-codex` → `gpt-5.3-codex`.

**Step 5: Commit**

```bash
git add commands/setup.md
git commit -m "fix: use claude mcp add instead of writing settings.json directly"
```

---

### Task 2b: Update README.md Manual MCP Setup section

**Files:**
- Modify: `README.md:110-124`

The README also shows the old `settings.json` approach for manual setup.

**Step 1: Replace the Manual MCP Setup section**

Replace:
```markdown
### Manual MCP Setup

If `/setup` doesn't work, manually add to `~/.claude/settings.json`:

\`\`\`json
{
  "mcpServers": {
    "codex": {
      "type": "stdio",
      "command": "codex",
      "args": ["-m", "gpt-5.2-codex", "mcp-server"]
    }
  }
}
\`\`\`
```

With:
```markdown
### Manual MCP Setup

If `/setup` doesn't work, register the MCP server manually:

\`\`\`bash
claude mcp add --transport stdio --scope user codex -- codex -m gpt-5.3-codex mcp-server
\`\`\`

Verify with:

\`\`\`bash
claude mcp list
\`\`\`
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "fix: use claude mcp add in README manual setup"
```

---

### Task 3: Rewrite orchestration.md — Session Management section

**Files:**
- Modify: `rules/orchestration.md:1-11,25-36,100-101,122-156`

This is the largest change. Replace the "Stateless Design" section and update related areas.

**Step 1: Update Available Tools table and note (lines 7-11)**

Replace the tools table and note with:

```markdown
## Available Tools

| Tool | Provider | Use For |
|------|----------|---------|
| `mcp__codex__codex` | GPT | Start a new expert session |
| `mcp__codex__codex-reply` | GPT | Continue an existing session (multi-turn) |
```

**Step 2: Replace "Stateless Design" section (lines 25-36) with "Session Management"**

Replace the entire section with:

```markdown
## Session Management

Codex supports two delegation patterns:

### Single-Shot (Default)

Use `mcp__codex__codex` for independent tasks. Each call starts a fresh session with no memory of previous calls. Include ALL relevant context in the delegation prompt.

**Best for:** Advisory reviews, one-off analysis, independent implementation tasks.

### Multi-Turn

`mcp__codex__codex` returns a `threadId` in its response. Pass this to `mcp__codex__codex-reply` for follow-up turns with full context preservation.

```typescript
// Turn 1: Start session
const result = mcp__codex__codex({
  prompt: "Implement input validation for the user endpoint",
  "developer-instructions": "[expert prompt]",
  cwd: "/path/to/project"
})
// result includes threadId: "019c58e5-..."

// Turn 2: Follow up with context preserved
mcp__codex__codex-reply({
  threadId: "019c58e5-...",
  prompt: "Now add tests for the validation you just implemented"
})
```

**Best for:** Chained implementation steps, iterative refinement, retry after failure.

| Pattern | Tool | Context | Use When |
|---------|------|---------|----------|
| Single-shot | `codex` | Fresh each call | Advisory, one-off tasks |
| Multi-turn | `codex` → `codex-reply` | Preserved via threadId | Chained steps, retries |
```

**Step 3: Update Step 5 hint (line 100-101)**

Replace:
```markdown
**IMPORTANT:** Since each call is stateless, include FULL context:
```

With:
```markdown
**IMPORTANT:** For single-shot calls, include FULL context. For multi-turn, use `codex-reply` with the `threadId` from the initial call:
```

**Step 4: Update Retry Flow section (lines 122-156)**

Replace the entire Retry Flow section with:

```markdown
## Retry Flow (Implementation Mode)

When implementation fails verification, use multi-turn to retry with preserved context:

```
Attempt 1 (codex) → Verify → [Fail]
     ↓
Attempt 2 (codex-reply with threadId + error details) → Verify → [Fail]
     ↓
Attempt 3 (codex-reply with threadId + full error history) → Verify → [Fail]
     ↓
Escalate to user
```

### Retry with Multi-Turn

```typescript
// Attempt 1
const result = mcp__codex__codex({
  prompt: "[7-section delegation prompt]",
  "developer-instructions": "[expert prompt]",
  sandbox: "workspace-write",
  cwd: "/path/to/project"
})

// Attempt 2 (context preserved — expert remembers attempt 1)
mcp__codex__codex-reply({
  threadId: result.threadId,
  prompt: `The previous implementation failed verification.
Error: [exact error message]
Fix the issue and verify the change works.`
})
```

### Retry with Single-Shot (Fallback)

If multi-turn is unavailable, use a new `codex` call with full context:

```markdown
TASK: [Original task]

PREVIOUS ATTEMPT:
- What was done: [summary of changes made]
- Error encountered: [exact error message]
- Files modified: [list]

REQUIREMENTS:
- Fix the error from the previous attempt
- [Original requirements]
```
```

**Step 5: Add "Codex Configuration Defaults" section before Cost Awareness**

Insert before the "Cost Awareness" section:

```markdown
---

## Codex Configuration Defaults

Set global defaults in `~/.codex/config.toml` so you don't need to pass `sandbox` and `approval-policy` on every call:

```toml
# ~/.codex/config.toml
sandbox = "workspace-write"
ask_for_approval = "on-failure"
```

Per-call parameters override these defaults. For example, pass `sandbox: "read-only"` to override the global default for advisory-only tasks.

### Project Trust Levels

Codex also supports per-project trust configuration:

```toml
[projects."/path/to/your/project"]
trust_level = "trusted"
```

Trusted projects allow the expert full access within the sandbox policy.
```

**Step 6: Commit**

```bash
git add rules/orchestration.md
git commit -m "docs: add multi-turn support, config defaults, fix stateless claims"
```

---

### Task 4: Expand model-selection.md parameters table

**Files:**
- Modify: `rules/model-selection.md:105-112`

**Step 1: Replace the Codex Parameters Reference table**

Replace lines 105-112 with:

```markdown
## Codex Parameters Reference

### `mcp__codex__codex` (Start Session)

| Parameter | Values | Notes |
|-----------|--------|-------|
| `prompt` | string | **Required.** The delegation prompt (use 7-section format) |
| `developer-instructions` | string | Expert prompt injection (from `prompts/*.md`) |
| `sandbox` | `read-only`, `workspace-write`, `danger-full-access` | Controls file access. Default from `~/.codex/config.toml` |
| `approval-policy` | `untrusted`, `on-failure`, `on-request`, `never` | Controls shell command approval. Default from config |
| `model` | e.g. `gpt-5.3-codex` | Override the default model |
| `config` | key-value object | Override `config.toml` settings per-call |
| `cwd` | path | Working directory for the task |

### `mcp__codex__codex-reply` (Continue Session)

| Parameter | Values | Notes |
|-----------|--------|-------|
| `threadId` | string | **Required.** Thread ID from previous `codex` call |
| `prompt` | string | **Required.** Follow-up instruction |
```

**Step 2: Commit**

```bash
git add rules/model-selection.md
git commit -m "docs: expand Codex parameters reference with full param list"
```

---

### Task 5: Update README.md — model version, multi-turn, config defaults

**Files:**
- Modify: `README.md:120,89-93,97-134`

**Step 1: Replace model version in Manual MCP Setup (line 120)**

```json
      "args": ["-m", "gpt-5.3-codex", "mcp-server"]
```

**Step 2: Add multi-turn to "Key details" (after line 93)**

Replace the key details list:

```markdown
**Key details:**
- Each expert has a specialized system prompt (in `prompts/`)
- Claude reads your request → picks the right expert → delegates via MCP
- Responses are synthesized, not passed through raw
- Experts can retry up to 3 times before escalating
- Multi-turn conversations preserve context via `threadId` for chained tasks
```

**Step 3: Add "Multi-Turn Conversations" subsection after "How It Works"**

Insert before the `---` on line 95:

```markdown

### Multi-Turn Conversations

For chained implementation steps, the expert preserves context across turns:

```
Turn 1: mcp__codex__codex → returns threadId
Turn 2: mcp__codex__codex-reply(threadId) → expert remembers turn 1
Turn 3: mcp__codex__codex-reply(threadId) → expert remembers turns 1-2
```

Use single-shot (`codex` only) for advisory tasks. Use multi-turn for implementation chains and retries.
```

**Step 4: Add "Configuration Defaults" subsection after Operating Modes (after line 108)**

Insert after "Claude automatically selects the mode based on your request.":

```markdown

### Configuration Defaults

Set global defaults in `~/.codex/config.toml` instead of passing parameters on every call:

```toml
sandbox = "workspace-write"
ask_for_approval = "on-failure"
```

Per-call parameters override these defaults. See [Codex CLI docs](https://github.com/openai/codex) for all config options.
```

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add multi-turn and config defaults sections to README"
```

---

### Task 6: Update CLAUDE.md — correct stateless claims, bump model

**Files:**
- Modify: `CLAUDE.md:28,56,86`

**Step 1: Update orchestration flow description (line 28)**

Replace:
```markdown
Claude acts as orchestrator—delegates to specialized GPT experts based on task type. Delegation is **stateless**: each `mcp__codex__codex` call is independent (no memory between calls).
```

With:
```markdown
Claude acts as orchestrator—delegates to specialized GPT experts based on task type. Supports both **single-shot** (independent calls) and **multi-turn** (context preserved via `threadId` with `codex-reply`).
```

**Step 2: Update retry handling (lines 55-58)**

Replace:
```markdown
### Retry Handling

Since each call is stateless, retries must include full history:
- Attempt 1 fails → new call with original task + error details
- Up to 3 attempts → then escalate to user
```

With:
```markdown
### Retry Handling

Retries use multi-turn (`codex-reply` with `threadId`) so the expert remembers previous attempts:
- Attempt 1 fails → `codex-reply` with error details (context preserved)
- Up to 3 attempts → then escalate to user
- Fallback: new `codex` call with full history if multi-turn unavailable
```

**Step 3: Update Key Design Decisions (line 86)**

Replace:
```markdown
2. **Stateless calls** - Each delegation includes full context (Codex MCP doesn't expose session IDs to Claude Code)
```

With:
```markdown
2. **Single-shot + multi-turn** - Single-shot for advisory (full context per call), multi-turn via `threadId`/`codex-reply` for chained implementation and retries
```

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: correct stateless claims, document multi-turn support"
```

---

### Task 8: Final review — verify all outdated references are gone

**Step 1: Search for any remaining gpt-5.2 references**

Run: `grep -r "5\.2" --include="*.md" --include="*.json" .`
Expected: No matches (excluding git history and node_modules)

**Step 2: Search for remaining "stateless" claims that are now incorrect**

Run: `grep -rn "stateless" --include="*.md" .`
Review: Ensure no remaining claims that delegation is fully stateless. The word "stateless" is fine in contexts like "single-shot calls are stateless."

**Step 3: Search for remaining settings.json MCP config references**

Run: `grep -rn "settings.json" --include="*.md" .`
Review: Ensure no remaining instructions to write MCP config to `~/.claude/settings.json`. The setup troubleshooting table in README may still reference checking settings.json — update to reference `claude mcp list` instead.

**Step 4: Commit any stragglers if found**

Only if steps 1-3 reveal missed references.
