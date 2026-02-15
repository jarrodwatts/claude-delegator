---
name: uninstall
description: Uninstall claude-delegator (remove MCP config and rules)
allowed-tools: Bash, Read, Write, Edit, AskUserQuestion
timeout: 30000
---

# Uninstall

Remove claude-delegator from Claude Code.

## Confirm Removal

**Question**: "Remove Codex/Gemini MCP configuration and plugin rules?"
**Options**:
- "Yes, uninstall"
- "No, cancel"

If cancelled, stop here.

## Remove MCP Configuration

```bash
claude mcp remove --scope user codex
claude mcp remove --scope user gemini
```

## Remove Installed Rules

```bash
rm -rf ~/.claude/rules/delegator/
```

## Confirm Completion

```
✓ Removed providers from MCP servers
✓ Removed rules from ~/.claude/rules/delegator/

To reinstall: /claude-delegator:setup
```
