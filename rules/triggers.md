# Delegation Triggers

This file defines when to delegate to GPT experts via Codex.

## IMPORTANT: Check These Triggers on EVERY Message

You MUST scan incoming messages for delegation triggers. This is NOT optional.

**Behavior:**
1. **PROACTIVE**: On every user message, check if semantic triggers match → delegate automatically
2. **REACTIVE**: If user explicitly mentions GPT/Codex or Gemini → delegate immediately

When a trigger matches:
1. Identify the appropriate expert
2. Read their prompt file from `${CLAUDE_PLUGIN_ROOT}/prompts/[expert].md`
3. Follow the delegation flow in `rules/orchestration.md`

---

## Available Experts

| Expert | Specialty | Use For |
|--------|-----------|---------|
| **Architect** | System design, tradeoffs | Architecture decisions, complex debugging |
| **Plan Reviewer** | Plan validation | Reviewing work plans before execution |
| **Scope Analyst** | Pre-planning analysis | Catching ambiguities before work starts |
| **Code Reviewer** | Code quality, bugs | Reviewing code changes, finding issues |
| **Security Analyst** | Vulnerabilities, threats | Security audits, hardening |

## Explicit Triggers (Highest Priority)

User explicitly requests delegation:

| Phrase Pattern | Expert |
|----------------|--------|
| "ask GPT", "consult GPT" | Route based on context |
| "ask Gemini", "ask gemini" | Route based on context |
| "review this architecture" | Architect |
| "review this plan" | Plan Reviewer |
| "analyze the scope" | Scope Analyst |
| "review this code" | Code Reviewer |
| "security review", "is this secure" | Security Analyst |

## Semantic Triggers (Intent Matching)

### Architecture & Design (→ Architect)

| Intent Pattern | Example |
|----------------|---------|
| "how should I structure" | "How should I structure this service?" |
| "what are the tradeoffs" | "Tradeoffs of this caching approach" |
| "should I use [A] or [B]" | "Should I use microservices or monolith?" |
| System design questions | "Design a notification system" |
| After 2+ failed fix attempts | Escalation for fresh perspective |

### Plan Validation (→ Plan Reviewer)

| Intent Pattern | Example |
|----------------|---------|
| "review this plan" | "Review my migration plan" |
| "is this plan complete" | "Is this implementation plan complete?" |
| "validate before I start" | "Validate my approach before starting" |
| Before significant work | Pre-execution validation |

### Requirements Analysis (→ Scope Analyst)

| Intent Pattern | Example |
|----------------|---------|
| "what am I missing" | "What am I missing in these requirements?" |
| "clarify the scope" | "Help clarify the scope of this feature" |
| Vague or ambiguous requests | Before planning unclear work |
| "before we start" | Pre-planning consultation |

### Code Review (→ Code Reviewer)

| Intent Pattern | Example |
|----------------|---------|
| "review this code" | "Review this PR" |
| "find issues in" | "Find issues in this implementation" |
| "what's wrong with" | "What's wrong with this function?" |
| After implementing features | Self-review before merge |

### Security (→ Security Analyst)

| Intent Pattern | Example |
|----------------|---------|
| "security implications" | "Security implications of this auth flow" |
| "is this secure" | "Is this token handling secure?" |
| "vulnerabilities in" | "Any vulnerabilities in this code?" |
| "threat model" | "Threat model for this API" |
| "harden this" | "Harden this endpoint" |

## Trigger Priority

1. **Explicit user request** - Always honor direct requests
2. **Security concerns** - When handling sensitive data/auth
3. **Architecture decisions** - System design with long-term impact
4. **Failure escalation** - After 2+ failed attempts
5. **Don't delegate** - Default: handle directly

## When NOT to Delegate

| Situation | Reason |
|-----------|--------|
| Simple syntax questions | Answer directly |
| Direct file operations | No external insight needed |
| Trivial bug fixes | Obvious solution |
| Research/documentation | Use other tools |
| First attempt at any fix | Try yourself first |

## Advisory vs Implementation Mode

Any expert can operate in two modes:

| Mode | Sandbox | When to Use |
|------|---------|-------------|
| **Advisory** | `read-only` | Analysis, recommendations, review verdicts |
| **Implementation** | `workspace-write` | Actually making changes, fixing issues |

Set the sandbox based on what the task requires, not the expert type.

**Examples:**

```typescript
// Architect analyzing (advisory via Codex)
mcp__codex__codex({
  prompt: "Analyze tradeoffs of Redis vs in-memory caching",
  sandbox: "read-only"
})

// Architect implementing (implementation via Gemini)
mcp__gemini__gemini({
  prompt: "Refactor the caching layer to use Redis",
  sandbox: "workspace-write"
})

// Security Analyst reviewing (advisory via Gemini)
mcp__gemini__gemini({
  prompt: "Review this auth flow for vulnerabilities",
  sandbox: "read-only"
})

// Security Analyst hardening (implementation via Codex)
mcp__codex__codex({
  prompt: "Fix the SQL injection vulnerability in user.ts",
  sandbox: "workspace-write"
})
```
