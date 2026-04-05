# SkillsHub Context Engineering Protocol

## Purpose
This folder is the **living memory** of the SkillsHub project. Every agent session reads it before starting work and writes to it after completing work. It eliminates context loss across sessions, captures hard-won lessons, and prevents repeating mistakes.

## Folder Structure

```
context/
├── CONTEXT_PROTOCOL.md      ← You are here. Rules for maintaining context.
├── STATE.md                  ← CURRENT STATE: What's done, what's next, what's blocked.
├── DECISIONS.md              ← Architecture decisions with rationale (ADR-style).
├── PATTERNS.md               ← Proven patterns that work in THIS project.
├── GOTCHAS.md                ← Bugs, footguns, and things that wasted time.
├── SKILLS_REFERENCE.md       ← Quick-ref of which skill guidelines apply where.
├── phases/
│   ├── phase-0-foundation.md
│   ├── phase-1-schema.md
│   ├── phase-2-search.md
│   ├── phase-3-auth.md
│   ├── phase-4-dashboard.md
│   ├── phase-5-marketplace.md
│   ├── phase-6-extension.md
│   └── phase-7-polish.md
```

## Read/Write Protocol

### Before ANY Task
1. Read `STATE.md` — know where we are
2. Read the current phase file (`phases/phase-X-*.md`) — know phase-specific context
3. Read `GOTCHAS.md` — avoid known pitfalls
4. Read `PATTERNS.md` — use established patterns

### After EVERY Task
1. Update `STATE.md` — mark what's done, what's next
2. Update the phase file — log what was built, what was learned
3. If you hit a bug/gotcha → add to `GOTCHAS.md`
4. If you established a pattern → add to `PATTERNS.md`
5. If you made an architecture decision → add to `DECISIONS.md`

### After EVERY Phase
1. Write a phase retrospective in the phase file
2. Update `STATE.md` with phase completion summary
3. Review and consolidate `GOTCHAS.md` (remove resolved, keep systemic)

## Format Standards

### STATE.md Entry Format
```markdown
## Current State
- **Phase**: [number and name]
- **Task**: [current task ID and name]
- **Status**: [IN_PROGRESS | BLOCKED | COMPLETE]
- **Last Updated**: [timestamp]

## What Just Happened
[1-3 sentences on what was just completed]

## What's Next
[The immediate next task with any prep notes]

## Blockers
[Anything preventing progress]
```

### GOTCHAS.md Entry Format
```markdown
### [Short Title] — [Phase X.Y]
**Symptom**: What went wrong
**Root Cause**: Why it went wrong
**Fix**: How we fixed it
**Prevention**: How to avoid it next time
```

### DECISIONS.md Entry Format (ADR-lite)
```markdown
### ADR-XXX: [Title] — [Date]
**Context**: Why this decision was needed
**Decision**: What we decided
**Alternatives Considered**: What else we evaluated
**Consequences**: What this means going forward
```

### PATTERNS.md Entry Format
```markdown
### [Pattern Name] — [Category]
**When**: When to use this pattern
**How**: Code snippet or description
**Why**: Why this works in our context
**Skill Reference**: Which skill guideline this follows
```
