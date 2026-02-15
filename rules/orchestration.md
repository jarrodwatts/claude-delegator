# Model Orchestration

You have access to GPT experts via MCP tools. Use them strategically based on these guidelines.

## Available Tools

| Tool | Provider | Use For |
|------|----------|---------|
| `mcp__codex__codex` | GPT | Start a new expert session |
| `mcp__codex__codex-reply` | GPT | Continue an existing session (multi-turn) |
| `mcp__gemini__gemini` | Gemini | Start a new expert session |
| `mcp__gemini__gemini-reply` | Gemini | Continue an existing session (multi-turn) |

## Available Experts

| Expert | Specialty | Prompt File |
|--------|-----------|-------------|
| **Architect** | System design, tradeoffs, complex debugging | `${CLAUDE_PLUGIN_ROOT}/prompts/architect.md` |
| **Plan Reviewer** | Plan validation before execution | `${CLAUDE_PLUGIN_ROOT}/prompts/plan-reviewer.md` |
| **Scope Analyst** | Pre-planning, catching ambiguities | `${CLAUDE_PLUGIN_ROOT}/prompts/scope-analyst.md` |
| **Code Reviewer** | Code quality, bugs, security issues | `${CLAUDE_PLUGIN_ROOT}/prompts/code-reviewer.md` |
| **Security Analyst** | Vulnerabilities, threat modeling | `${CLAUDE_PLUGIN_ROOT}/prompts/security-analyst.md` |

---

## Session Management

Codex and Gemini support two delegation patterns:

### Single-Shot (Default)

Use `mcp__codex__codex` or `mcp__gemini__gemini` for independent tasks. Each call starts a fresh session with no memory of previous calls. Include ALL relevant context in the delegation prompt.

**Best for:** Advisory reviews, one-off analysis, independent implementation tasks.

### Multi-Turn

Both providers support multi-turn interactions. The initial call returns a `threadId` in its response. Pass this to the corresponding `-reply` tool for follow-up turns with full context preservation.

```typescript
// Turn 1: Start session (Codex example)
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
| Single-shot | `codex` / `gemini` | Fresh each call | Advisory, one-off tasks |
| Multi-turn | `*-reply` | Preserved via threadId | Chained steps, retries |

---

## PROACTIVE Delegation (Check on EVERY message)

Before handling any request, check if an expert would help:

| Signal | Expert |
|--------|--------|
| Architecture/design decision | Architect |
| 2+ failed fix attempts on same issue | Architect (fresh perspective) |
| "Review this plan", "validate approach" | Plan Reviewer |
| Vague/ambiguous requirements | Scope Analyst |
| "Review this code", "find issues" | Code Reviewer |
| Security concerns, "is this secure" | Security Analyst |

**If a signal matches → delegate to the appropriate expert.**

---

## REACTIVE Delegation (Explicit User Request)

When user explicitly requests GPT/Codex or Gemini:

| User Says | Action |
|-----------|--------|
| "ask GPT", "consult GPT", "ask codex" | Identify task type → route to appropriate expert |
| "ask Gemini", "consult Gemini", "ask gemini" | Identify task type → route to appropriate expert |
| "ask GPT to review the architecture" | Delegate to Architect |
| "have Gemini review this code" | Delegate to Code Reviewer |
| "GPT security review" | Delegate to Security Analyst |

**Always honor explicit requests.**

---

## Delegation Flow (Step-by-Step)

When delegation is triggered:

### Step 1: Identify Expert
Match the task to the appropriate expert based on triggers.

### Step 2: Read Expert Prompt
**CRITICAL**: Read the expert's prompt file to get their system instructions:

```
Read ${CLAUDE_PLUGIN_ROOT}/prompts/[expert].md
```

For example, for Architect: `Read ${CLAUDE_PLUGIN_ROOT}/prompts/architect.md`

### Step 3: Determine Mode
| Task Type | Mode | Sandbox |
|-----------|------|---------|
| Analysis, review, recommendations | Advisory | `read-only` |
| Make changes, fix issues, implement | Implementation | `workspace-write` |

### Step 4: Notify User
Always inform the user before delegating:
```
Delegating to [Expert Name]: [brief task summary]
```

### Step 5: Build Delegation Prompt
Use the 7-section format from `rules/delegation-format.md`.

**IMPORTANT:** For single-shot calls, include FULL context. For multi-turn, use the appropriate `*-reply` tool with the `threadId` from the initial call:
- What the user asked for
- Relevant code/files
- Any previous attempts and their results (for retries)

### Step 6: Call the Expert
```typescript
// Using Codex (GPT)
mcp__codex__codex({
  prompt: "[your 7-section delegation prompt with FULL context]",
  "developer-instructions": "[contents of the expert's prompt file]",
  sandbox: "[read-only or workspace-write based on mode]",
  cwd: "[current working directory]"
})

// OR Using Gemini
mcp__gemini__gemini({
  prompt: "[your 7-section delegation prompt with FULL context]",
  "developer-instructions": "[contents of the expert's prompt file]",
  sandbox: "[read-only or workspace-write based on mode]",
  cwd: "[current working directory]"
})
```

### Step 7: Handle Response
1. **Synthesize** - Never show raw output directly
2. **Extract insights** - Key recommendations, issues, changes
3. **Apply judgment** - Experts can be wrong; evaluate critically
4. **Verify implementation** - For implementation mode, confirm changes work

---

## Retry Flow (Implementation Mode)

When implementation fails verification, use multi-turn to retry with preserved context:

```
Attempt 1 (initial call) → Verify → [Fail]
     ↓
Attempt 2 (*-reply with threadId + error details) → Verify → [Fail]
     ↓
Attempt 3 (*-reply with threadId + full error history) → Verify → [Fail]
     ↓
Escalate to user
```

### Retry with Multi-Turn

```typescript
// Attempt 1 (Codex or Gemini)
const result = mcp__codex__codex({ ... }) // or mcp__gemini__gemini

// Attempt 2 (context preserved — expert remembers attempt 1)
mcp__codex__codex-reply({ // or mcp__gemini__gemini-reply
  threadId: result.threadId,
  prompt: `The previous implementation failed verification.
Error: [exact error message]
Fix the issue and verify the change works.`
})
```

### Retry with Single-Shot (Fallback)

If multi-turn is unavailable, use a new delegation call with full context:

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

---

## Example: Architecture Question

User: "What are the tradeoffs of Redis vs in-memory caching?"

**Step 1**: Signal matches "Architecture decision" → Architect

**Step 2**: Read `${CLAUDE_PLUGIN_ROOT}/prompts/architect.md`

**Step 3**: Advisory mode (question, not implementation) → `read-only`

**Step 4**: "Delegating to Architect: Analyze caching tradeoffs"

**Step 5-6**:
```typescript
mcp__codex__codex({
  prompt: `TASK: Analyze tradeoffs between Redis and in-memory caching for [context].
EXPECTED OUTCOME: Clear recommendation with rationale.
CONTEXT: [user's situation, full details]
...`,
  "developer-instructions": "[contents of architect.md]",
  sandbox: "read-only"
})
```

**Step 7**: Synthesize response, add your assessment.

---

## Example: Retry After Failed Implementation

First attempt failed with "TypeError: Cannot read property 'x' of undefined"

**Attempt 1 (initial call):**
```typescript
const result = mcp__codex__codex({
  prompt: `TASK: Add input validation to the user registration endpoint.

CONTEXT:
- Express 4.x application
- Body parser middleware exists in app.ts
- [relevant code snippets]

REQUIREMENTS:
- Add validation middleware to routes/auth.ts
- Ensure validation runs after body parser
- Report all files modified`,
  "developer-instructions": "[contents of code-reviewer.md]",
  sandbox: "workspace-write",
  cwd: "/path/to/project"
})
```

**Attempt 2 (retry via multi-turn):**
```typescript
mcp__codex__codex-reply({
  threadId: result.threadId,
  prompt: `The previous implementation failed verification.
Error: TypeError: Cannot read property 'x' of undefined at line 45
The middleware was added but req.body was undefined.
Fix the issue — ensure validation runs after body parser.`
})
```

---

## Codex Configuration Defaults

Set global defaults in `~/.codex/config.toml` so you don't need to pass `sandbox_mode` and `approval_policy` on every call:

```toml
# ~/.codex/config.toml
sandbox_mode = "workspace-write"
approval_policy = "on-failure"
```

Per-call parameters override these defaults. For example, pass `sandbox: "read-only"` to override the global default for advisory-only tasks.

### Project Trust Levels

Codex also supports per-project trust configuration:

```toml
[projects."/path/to/your/project"]
trust_level = "trusted"
```

Trusted projects allow the expert full access within the sandbox policy.

---

## Cost Awareness

- **Don't spam** - One well-structured delegation beats multiple vague ones
- **Include full context** - Saves retry costs from missing information
- **Reserve for high-value tasks** - Architecture, security, complex analysis

---

## Anti-Patterns

| Don't Do This | Do This Instead |
|---------------|-----------------|
| Delegate trivial questions | Answer directly |
| Show raw expert output | Synthesize and interpret |
| Delegate without reading prompt file | ALWAYS read and inject expert prompt |
| Skip user notification | ALWAYS notify before delegating |
| Retry without including error context | Include FULL history of what was tried |
| Assume expert remembers across sessions | Use the appropriate `*-reply` tool for multi-turn; include full context for single-shot |
