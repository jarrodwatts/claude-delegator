---
name: setup
description: Configure claude-delegator with Codex (GPT) or Gemini MCP servers
allowed-tools: Bash, Read, Write, Edit, AskUserQuestion
timeout: 60000
---

# Setup

Configure GPT (via Codex) or Gemini as specialized expert subagents via native MCP. Five domain experts that can advise OR implement.

## Step 1: Check CLI Dependencies

### Codex (GPT)
```bash
which codex 2>/dev/null && codex --version 2>&1 | head -1 || echo "CODEX_MISSING"
```

### Gemini
```bash
which gemini 2>/dev/null && gemini --version 2>&1 | head -1 || echo "GEMINI_MISSING"
```

### If Missing

**Codex Missing:**
```
Codex CLI not found.
Install with: npm install -g @openai/codex
Then authenticate: codex login
```

**Gemini Missing:**
```
Gemini CLI not found.
Install with: npm install -g @google/gemini-cli
Then authenticate: launch `gemini` once and complete sign-in (or set `GOOGLE_API_KEY`)
```

**STOP here if no providers are installed.**

## Step 2: Configure MCP Servers

Register your preferred provider(s) as MCP servers using Claude Code's native command:

### Codex (GPT)
```bash
# Idempotent: safe to rerun setup
claude mcp remove codex >/dev/null 2>&1 || true
claude mcp add --transport stdio --scope user codex -- codex -m gpt-5.3-codex mcp-server
```

### Gemini
```bash
# Idempotent: safe to rerun setup
claude mcp remove gemini >/dev/null 2>&1 || true
claude mcp add --transport stdio --scope user gemini -- node ${CLAUDE_PLUGIN_ROOT}/server/gemini/index.js
```

This registers the MCP servers at user scope (available across all projects).

**Note:** To customise Codex behaviour, add CLI flags before `mcp-server`.
- For Codex: `-p nosandbox`

## Step 3: Install Orchestration Rules

```bash
mkdir -p ~/.claude/rules/delegator && cp ${CLAUDE_PLUGIN_ROOT}/rules/*.md ~/.claude/rules/delegator/
```

## Step 4: Verify Installation

Run these checks and report results:

```bash
# Check 1: CLI versions
codex --version 2>&1 | head -1 || echo "Not installed"
gemini --version 2>&1 | head -1 || echo "Not installed"

# Check 2: Codex MCP server
CODEX_CONFIG=$(claude mcp get codex 2>/dev/null)
if echo "$CODEX_CONFIG" | grep -q "codex"; then
  MODEL=$(echo "$CODEX_CONFIG" | grep -oE 'gpt-[0-9]+\.[0-9]+-?[a-z]*' | head -1)
  echo "Codex: OK (model: ${MODEL:-unknown})"
else
  echo "Codex: NOT CONFIGURED"
fi

# Check 3: Gemini MCP server
GEMINI_CONFIG=$(claude mcp get gemini 2>/dev/null)
if echo "$GEMINI_CONFIG" | grep -q "server/gemini/index.js"; then
  echo "Gemini: OK"
else
  echo "Gemini: NOT CONFIGURED"
fi

# Check 4: Gemini bridge health (initialize handshake)
if echo "$GEMINI_CONFIG" | grep -q "server/gemini/index.js"; then
  BRIDGE_HEALTH=$(printf '{"jsonrpc":"2.0","id":"health","method":"initialize","params":{}}\n' \
    | node "${CLAUDE_PLUGIN_ROOT}/server/gemini/index.js" 2>/dev/null \
    | grep -q '"id":"health"' && echo "Gemini Bridge: HEALTHY" || echo "Gemini Bridge: UNHEALTHY")
  echo "$BRIDGE_HEALTH"
else
  echo "Gemini Bridge: SKIPPED (Gemini MCP not configured)"
fi

# Check 5: Rules installed (count files)
ls ~/.claude/rules/delegator/*.md 2>/dev/null | wc -l

# Check 6: Codex auth status
codex login status 2>&1 | head -1 || echo "Codex: Run 'codex login'"
```

## Step 5: Report Status

Display actual values from the checks above:

```
claude-delegator Status
───────────────────────────────────────────────────
Codex CLI:     [version from check 1]
Gemini CLI:    [version from check 1]
Codex MCP:     [status from check 2]
Gemini MCP:    [status from check 3]
Gemini Bridge: [status from check 4]
Rules:         ✓ [N] files in ~/.claude/rules/delegator/
Codex Auth:    [status from check 6]
───────────────────────────────────────────────────
```

If any check fails, report the specific issue and how to fix it.

## Step 6: Final Instructions

```
Setup complete!

Next steps:
1. Restart Claude Code to load MCP server(s)
2. Authenticate providers as needed:
   - Codex: Run `codex login`
   - Gemini: Run `gemini` once and complete the sign-in flow (or set `GOOGLE_API_KEY`)

Five experts available:

┌──────────────────┬─────────────────────────────────────────────┐
│ Architect        │ "How should I structure this service?"      │
│                  │ "What are the tradeoffs of Redis vs X?"     │
│                  │ → System design, architecture decisions     │
├──────────────────┼─────────────────────────────────────────────┤
│ Plan Reviewer    │ "Review this migration plan"                │
│                  │ "Is this implementation plan complete?"     │
│                  │ → Plan validation before execution          │
├──────────────────┼─────────────────────────────────────────────┤
│ Scope Analyst    │ "Clarify the scope of this feature"         │
│                  │ "What am I missing in these requirements?"  │
│                  │ → Pre-planning, catches ambiguities         │
├──────────────────┼─────────────────────────────────────────────┤
│ Code Reviewer    │ "Review this PR"                            │
│                  │ "Find issues in this implementation"        │
│                  │ → Code quality, bugs, maintainability       │
├──────────────────┼─────────────────────────────────────────────┤
│ Security Analyst │ "Is this authentication flow secure?"       │
│                  │ "Harden this endpoint"                      │
│                  │ → Vulnerabilities, threat modeling          │
└──────────────────┴─────────────────────────────────────────────┘

Every expert can advise (read-only) OR implement (write).
Expert is auto-detected based on your request.
Explicit: "Ask GPT to..." or "Ask Gemini to..."
```

## Step 7: Ask About Starring

Use AskUserQuestion to ask the user if they'd like to ⭐ star the claude-delegator repository on GitHub to support the project.

Options: "Yes, star the repo" / "No thanks"

**If yes**: Check if `gh` CLI is available and run:
```bash
gh api -X PUT /user/starred/jarrodwatts/claude-delegator
```

If `gh` is not available or the command fails, provide the manual link:
```
https://github.com/jarrodwatts/claude-delegator
```

**If no**: Thank them and complete setup without starring.
