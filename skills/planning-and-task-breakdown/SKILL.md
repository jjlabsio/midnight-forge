---
name: planning-and-task-breakdown
description: Breaks work into ordered tasks. Use when you have a spec or clear requirements and need to break work into implementable tasks. Use when a task feels too large to start, when you need to estimate scope, or when parallel work is possible.
---

# Planning and Task Breakdown

## Overview

Decompose work into small, verifiable tasks with explicit acceptance criteria. Good task breakdown is the difference between an agent that completes work reliably and one that produces a tangled mess. Every task should be small enough to implement, test, and verify in a single focused session.

## When to Use

- You have a spec and need to break it into implementable units
- A task feels too large or vague to start
- Work needs to be parallelized across multiple agents or sessions
- You need to communicate scope to a human
- The implementation order isn't obvious

**When NOT to use:** Single-file changes with obvious scope, or when the spec already contains well-defined tasks.

## The Planning Process

### Step 1: Enter Plan Mode

Before writing any code, operate in read-only mode:

- Read the spec and relevant codebase sections
- Identify existing patterns and conventions
- Map dependencies between components
- Note risks and unknowns

**Do NOT write code during planning.** The output is a plan document, not implementation.

### Step 2: Identify the Dependency Graph

Map what depends on what:

```
Database schema
    │
    ├── API models/types
    │       │
    │       ├── API endpoints
    │       │       │
    │       │       └── Frontend API client
    │       │               │
    │       │               └── UI components
    │       │
    │       └── Validation logic
    │
    └── Seed data / migrations
```

Implementation order follows the dependency graph bottom-up: build foundations first.

### Step 3: Slice Vertically

Instead of building all the database, then all the API, then all the UI — build one complete feature path at a time:

**Bad (horizontal slicing):**
```
Task 1: Build entire database schema
Task 2: Build all API endpoints
Task 3: Build all UI components
Task 4: Connect everything
```

**Good (vertical slicing):**
```
Task 1: User can create an account (schema + API + UI for registration)
Task 2: User can log in (auth schema + API + UI for login)
Task 3: User can create a task (task schema + API + UI for creation)
Task 4: User can view task list (query + API + UI for list view)
```

Each vertical slice delivers working, testable functionality.

### Step 4: Classify Requirement Risk

Before or while finalizing task acceptance criteria, classify every approved SPEC requirement as `normal` or `high-risk`.

This classification is an AI semantic judgment. Do not use or preserve a keyword list as the mechanism. Vocabulary can suggest where to look, but the decision is based on meaning: mark a requirement `high-risk` when implementation correctness depends on a non-obvious semantic property that ordinary happy-path tests could pass while the intended requirement remains wrong.

High-risk requirements commonly involve properties such as persisted state transitions, retries, continuation, recovery, ordering, eventual completion, concurrency, locks, leases, cursors, deduplication, idempotency, replacing one execution mechanism with another, no-stuck guarantees, or behavior where a later external retry would not satisfy a same-loop or same-invocation guarantee. These are examples, not a keyword classifier.

For each high-risk requirement, record:

```markdown
### High-Risk Requirement: [requirement title]

- Classification reason: [one concise sentence explaining why this is high-risk]
- Implementation meaning: [concrete behavior the implementation must provide]
- Required scenario: [positive scenario specific enough to become a regression test or agent-executable check]
- Negative scenario: [failure mode the verification must reject]
- Verification: [test, command, manual check, or review step that proves the meaning]
```

If no high-risk requirements are identified, the plan must say:

```markdown
No high-risk requirements identified because [concise semantic reason].
```

This statement is required so future reviewers can challenge the omission instead of inferring that no classification pass happened.

### Step 5: Write Tasks

Each task follows this structure:

```markdown
## Task [N]: [Short descriptive title]

**Description:** One paragraph explaining what this task accomplishes.

**Acceptance criteria:**
- [ ] [Specific, testable condition]
- [ ] [Specific, testable condition]

**High-risk semantic criteria:** [High-risk requirement IDs assigned to this task, with implementation meaning, or "None"]

**Verification:**
- [ ] Tests pass: `npm test -- --grep "feature-name"`
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: [description of what to verify]

**Dependencies:** [Task numbers this depends on, or "None"]

**Files likely touched:**
- `src/path/to/file.ts`
- `tests/path/to/test.ts`

**Estimated scope:** [Small: 1-2 files | Medium: 3-5 files | Large: 5+ files]
```

### Step 6: Order and Checkpoint

Arrange tasks so that:

1. Dependencies are satisfied (build foundation first)
2. Each task leaves the system in a working state
3. Verification checkpoints occur after every 2-3 tasks
4. High-risk tasks are early (fail fast)

Add explicit checkpoints:

```markdown
## Checkpoint: After Tasks 1-3
- [ ] All tests pass
- [ ] Application builds without errors
- [ ] Core user flow works end-to-end
- [ ] Review with human before proceeding
```

### Step 7: Evaluate and Revise

After drafting the plan, run an inline blocker-oriented self-review pass before saving or presenting it. This is the default `$plan` quality gate. Block only on issues likely to cause flawed implementation:

- Missing tasks or missing implementation steps needed to satisfy the spec
- TODO, TBD, placeholder text, or incomplete task sections
- Missing coverage for stated SPEC requirements
- Missing or incomplete requirement risk classification
- A high-risk requirement classified by keyword matching instead of semantic judgment
- A high-risk requirement missing `Classification reason`, `Implementation meaning`, `Required scenario`, `Negative scenario`, or `Verification`
- Missing explicit `No high-risk requirements identified because ...` when no high-risk requirements are found
- Ordinary tests could pass while a stated semantic requirement remains wrong
- Same-loop, same-invocation, no-stuck, or eventual-completion guarantees are weakened into later retry or recovery behavior
- Major scope creep beyond the SPEC
- Task boundaries that are too vague, too large, or not independently verifiable
- Steps that would leave an implementer stuck because required context, files, contracts, or decisions are absent
- Missing concrete verification for a task or checkpoint
- Inconsistent file paths, type names, API names, command names, or dependencies across tasks
- Incorrect dependency ordering
- Genuine blockers or unknowns hidden from the plan instead of surfaced in risks or open questions

Revise the plan and repeat the inline self-review until there are no blockers or a focused user question is required. Do not block on wording polish, stylistic preferences, formatting preferences, or nice-to-have additions.

Subagent-assisted plan evaluation may be used only when both conditions are true:

1. The current user request explicitly authorizes subagents, delegation, or parallel agent work.
2. The runtime exposes the needed subagent tools.

When those conditions are met, use `agents/plan-evaluator.md` as the prompt template. In Claude Code, use the named `plan-evaluator` agent when available. In Codex, if named plugin agents are not directly available but generic subagents are explicitly authorized and available, pass the evaluator prompt template with the draft plan, the approved SPEC, relevant codebase constraints, and the blocker checklist above. The evaluator must return only blocker findings, `question needed`, or `no blockers`; it must not rewrite the plan or ask the user directly.

The main agent owns revisions, user questions, artifact saving, and deciding whether another evaluator pass is needed. If required information is missing, ask only the clarifying question or related small set of questions needed to unblock the current planning phase. Prefer one focused question, but ask multiple related questions when one answer would not resolve the ambiguity.

## Task Sizing Guidelines

| Size | Files | Scope | Example |
|------|-------|-------|---------|
| **XS** | 1 | Single function or config change | Add a validation rule |
| **S** | 1-2 | One component or endpoint | Add a new API endpoint |
| **M** | 3-5 | One feature slice | User registration flow |
| **L** | 5-8 | Multi-component feature | Search with filtering and pagination |
| **XL** | 8+ | **Too large — break it down further** | — |

If a task is L or larger, it should be broken into smaller tasks. An agent performs best on S and M tasks.

**When to break a task down further:**
- It would take more than one focused session (roughly 2+ hours of agent work)
- You cannot describe the acceptance criteria in 3 or fewer bullet points
- It touches two or more independent subsystems (e.g., auth and billing)
- You find yourself writing "and" in the task title (a sign it is two tasks)

## Plan Document Template

```markdown
# Implementation Plan: [Feature/Project Name]

## Overview
[One paragraph summary of what we're building]

## Architecture Decisions
- [Key decision 1 and rationale]
- [Key decision 2 and rationale]

## Task List

### Phase 1: Foundation
- [ ] Task 1: ...
- [ ] Task 2: ...

### Checkpoint: Foundation
- [ ] Tests pass, builds clean

### Phase 2: Core Features
- [ ] Task 3: ...
- [ ] Task 4: ...

### Checkpoint: Core Features
- [ ] End-to-end flow works

### Phase 3: Polish
- [ ] Task 5: ...
- [ ] Task 6: ...

### Checkpoint: Complete
- [ ] All acceptance criteria met
- [ ] Ready for review

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| [Risk] | [High/Med/Low] | [Strategy] |

## Open Questions
- [Question needing human input]
```

## MDF Artifact Storage

Save implementation plans under the current MDF work item by default. Before saving, verify MDF user and project init state; if init state is missing, stop and instruct the user to run `mdf init`.

```text
<canonical-root>/.mdf/work/{work_id}/plan-NNN.md
```

Resolve `canonical_root` and `work_id` from the active lock first. If there is no active lock, create an implicit work item. Repeated planning runs create `plan-001.md`, `plan-002.md`, and so on; update `item.md` `latest.plan` and `.mdf/index.jsonl`. Only create tracked files such as `tasks/plan.md` and `tasks/todo.md` when the user explicitly asks for repo-level planning files.

## Parallelization Opportunities

When multiple agents or sessions are available:

- **Safe to parallelize:** Independent feature slices, tests for already-implemented features, documentation
- **Must be sequential:** Database migrations, shared state changes, dependency chains
- **Needs coordination:** Features that share an API contract (define the contract first, then parallelize)

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll figure it out as I go" | That's how you end up with a tangled mess and rework. 10 minutes of planning saves hours. |
| "The tasks are obvious" | Write them down anyway. Explicit tasks surface hidden dependencies and forgotten edge cases. |
| "Planning is overhead" | Planning is the task. Implementation without a plan is just typing. |
| "I can hold it all in my head" | Context windows are finite. Written plans survive session boundaries and compaction. |

## Red Flags

- Starting implementation without a written task list
- Tasks that say "implement the feature" without acceptance criteria
- No verification steps in the plan
- All tasks are XL-sized
- No checkpoints between tasks
- Dependency order isn't considered

## Verification

Before starting implementation, confirm:

- [ ] Every task has acceptance criteria
- [ ] Every task has a verification step
- [ ] Task dependencies are identified and ordered correctly
- [ ] No task touches more than ~5 files
- [ ] Checkpoints exist between major phases
- [ ] The blocker-oriented evaluator loop found no implementation-blocking issues
- [ ] The human has reviewed and approved the plan
