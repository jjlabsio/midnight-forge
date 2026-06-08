---
name: incremental-implementation
description: Delivers changes incrementally. Use when implementing any feature or change that touches more than one file. Use when you're about to write a large amount of code at once, or when a task feels too big to land in one step.
---

# Incremental Implementation

## Overview

Build in thin vertical slices — implement one piece, test it, verify it, then expand. Avoid implementing an entire feature in one pass. Each increment should leave the system in a working, testable state. This is the execution discipline that makes large features manageable.

When saving implementation logs or build evidence, verify MDF user and project init state, resolve the current MDF work item, and write `.mdf/work/{work_id}/build-NNN.md`. If init state is missing, stop and instruct the user to run `mdf init`. Repeated saves create new revisions and update `item.md` `latest.build` plus `.mdf/index.jsonl`.

For MDF planned work, save a separate task-level build artifact after each completed planned task before moving to the next task, then save a separate task-scope review artifact. After all selected tasks are complete, save a separate final whole-build artifact, then save a separate whole-build review artifact. Build artifacts update `item.md` `latest.build` plus `.mdf/index.jsonl`; review artifacts update `item.md` `latest.review` plus `.mdf/index.jsonl`. After a complete `$mdf:build` run, the latest build pointer should reference the final whole-build artifact and the latest review pointer should reference the last passing whole-build or high-risk review artifact, whichever is later.

Embedded review summaries inside `build-NNN.md` may exist only as summaries or links. They do not satisfy task, whole-build, or high-risk review gates. The gate is satisfied only by a separate `review-NNN.md` artifact for the relevant scope.

## When to Use

- Implementing any multi-file change
- Building a new feature from a task breakdown
- Refactoring existing code
- Any time you're tempted to write more than ~100 lines before testing

**When NOT to use:** Single-file, single-function changes where the scope is already minimal.

## The Increment Cycle

```
┌──────────────────────────────────────┐
│                                      │
│   Implement ──→ Test ──→ Verify ──┐  │
│       ▲                           │  │
│       └───── Commit ◄─────────────┘  │
│              │                       │
│              ▼                       │
│          Next slice                  │
│                                      │
└──────────────────────────────────────┘
```

For each slice:

1. **Implement** the smallest complete piece of functionality
2. **Test** — run the test suite (or write a test if none exists)
3. **Verify** — confirm the slice works as expected (tests pass, build succeeds, manual check)
4. **Commit** -- save your progress with a descriptive message (see `git-workflow-and-versioning` for atomic commit guidance)
5. **Move to the next slice** — carry forward, don't restart

For MDF `build`, the selected work is normally every pending task from the current plan, in dependency order. Process only one task when the user explicitly asks for a single next task or names a specific task.

For each planned task:

1. Read the task acceptance criteria and verification steps
2. Write or identify the task-specific verification before implementation
3. Implement the smallest complete change for that task
4. Run task-relevant tests, build checks, lint/type checks, or manual instruction review
5. Save a task-level `.mdf/work/{work_id}/build-NNN.md` artifact with `Task Acceptance Traceability`
6. Save a separate task-scope `.mdf/work/{work_id}/review-NNN.md` artifact against the task acceptance criteria
7. Review the task against its acceptance criteria before moving to the next task
8. If the task review has blocking findings, save the blocking review artifact, fix the findings, rerun affected verification, update build evidence when needed, and save a later passing review artifact that references or clearly supersedes the blocking review
9. Commit the task-sized change only after the task build artifact and a passing task review artifact exist
10. Continue to the next pending task

The task-level build artifact must include a `Task Acceptance Traceability` matrix with one row per task acceptance criterion and one row per task-assigned high-risk semantic criterion:

```markdown
| Criterion | Risk | Verification | RED Evidence | GREEN Evidence | Code Path Reviewed | Status |
| --- | --- | --- | --- | --- | --- | --- |
| [criterion text] | normal or high-risk | [command/check] | [failing evidence or n/a with reason] | [passing evidence] | [file/function/path reviewed] | pass/fail |
```

High-risk rows are strict. `Verification`, `RED Evidence`, `GREEN Evidence`, and `Code Path Reviewed` must name concrete tests, commands, outputs, and code paths before the row can pass. Normal rows may use lighter evidence. Non-behavioral or documentation-only rows may use `n/a` only with a reason, such as `n/a - Markdown instruction update verified by manual review`.

After all selected tasks complete, run a whole-change verification loop:

1. Run the full test suite where available
2. Run build, typecheck, and lint commands where available
3. Save a separate final whole-build artifact to `.mdf/work/{work_id}/build-NNN.md`
4. Save a separate whole-build `.mdf/work/{work_id}/review-NNN.md` artifact against the spec and implementation plan
5. If the whole-build review has blocking findings, save the blocking review artifact, fix the findings, rerun affected verification, update build evidence when needed, and save a later passing review artifact that references or clearly supersedes the blocking review
6. If the plan contains any high-risk requirement, or build discovers a new high-risk semantic concern, run the high-risk independent review gate before claiming build completion

The final artifact must contain a `Whole-Build Spec Traceability` matrix. It should compare the final implementation back to the approved spec rather than only to the implementation plan:

```markdown
| Approved Spec Requirement | Covered Task IDs | Evidence | Integration / Semantic Checks | Status |
| --- | --- | --- | --- | --- |
| [spec requirement] | [task ids] | [tests/checks/artifacts] | [cross-task or high-risk semantic review] | pass/fail |
```

### High-Risk Independent Review Gate

When the plan contains at least one high-risk requirement, or build discovers a new high-risk semantic concern, build completion is blocked until a separate high-risk independent review passes.

Run this gate after:

1. All selected task-level build artifacts are saved
2. The final whole-build artifact is saved
3. Whole-build internal review has completed and blocking findings have been fixed

Run it before:

1. `$mdf:build` claims completion
2. Any final success summary implies the work is done

Scope the review narrowly to high-risk semantic compliance:

- Approved spec high-risk requirement text
- Plan classification reason and implementation meaning
- Required scenarios and negative scenarios
- Task build artifact RED/GREEN/code-path evidence
- Final whole-build traceability
- Actual changed code paths

Prefer fresh-context or subagent independent review only when both conditions are true:

1. The current user request explicitly authorizes subagents, delegation, or parallel agent work.
2. The runtime exposes the needed subagent tools.

If fresh-context/subagent review is unavailable or unauthorized, do not skip the gate. Run an inline standalone-like independent pass through `code-review-and-quality`, save a separate `.mdf/work/{work_id}/review-NNN.md`, and record `Freshness: standalone-like inline pass` or equivalent.

The high-risk independent review artifact must include:

```markdown
## Verdict

## Scope

## Requirement Checks

| Requirement | Implementation Meaning | Evidence Checked | Code Path Checked | Result |
| --- | --- | --- | --- | --- |

## Findings

## Fix Loop

## Freshness
```

This internal loop does not replace standalone `test`, `review`, or `ship`. Use `test` and `review` independently for manual changes, debugging, PR preparation, or pre-ship checks. Use `ship` as the final GO/NO-GO gate.

## Slicing Strategies

### Vertical Slices (Preferred)

Build one complete path through the stack:

```
Slice 1: Create a task (DB + API + basic UI)
    → Tests pass, user can create a task via the UI

Slice 2: List tasks (query + API + UI)
    → Tests pass, user can see their tasks

Slice 3: Edit a task (update + API + UI)
    → Tests pass, user can modify tasks

Slice 4: Delete a task (delete + API + UI + confirmation)
    → Tests pass, full CRUD complete
```

Each slice delivers working end-to-end functionality.

### Contract-First Slicing

When backend and frontend need to develop in parallel:

```
Slice 0: Define the API contract (types, interfaces, OpenAPI spec)
Slice 1a: Implement backend against the contract + API tests
Slice 1b: Implement frontend against mock data matching the contract
Slice 2: Integrate and test end-to-end
```

### Risk-First Slicing

Tackle the riskiest or most uncertain piece first:

```
Slice 1: Prove the WebSocket connection works (highest risk)
Slice 2: Build real-time task updates on the proven connection
Slice 3: Add offline support and reconnection
```

If Slice 1 fails, you discover it before investing in Slices 2 and 3.

## Implementation Rules

### Rule 0: Simplicity First

Before writing any code, ask: "What is the simplest thing that could work?"

After writing code, review it against these checks:
- Can this be done in fewer lines?
- Are these abstractions earning their complexity?
- Would a staff engineer look at this and say "why didn't you just..."?
- Am I building for hypothetical future requirements, or the current task?

```
SIMPLICITY CHECK:
✗ Generic EventBus with middleware pipeline for one notification
✓ Simple function call

✗ Abstract factory pattern for two similar components
✓ Two straightforward components with shared utilities

✗ Config-driven form builder for three forms
✓ Three form components
```

Three similar lines of code is better than a premature abstraction. Implement the naive, obviously-correct version first. Optimize only after correctness is proven with tests.

### Rule 0.5: Scope Discipline

Touch only what the task requires.

Do NOT:
- "Clean up" code adjacent to your change
- Refactor imports in files you're not modifying
- Remove comments you don't fully understand
- Add features not in the spec because they "seem useful"
- Modernize syntax in files you're only reading

If you notice something worth improving outside your task scope, note it — don't fix it:

```
NOTICED BUT NOT TOUCHING:
- src/utils/format.ts has an unused import (unrelated to this task)
- The auth middleware could use better error messages (separate task)
→ Want me to create tasks for these?
```

### Rule 1: One Thing at a Time

Each increment changes one logical thing. Don't mix concerns:

**Bad:** One commit that adds a new component, refactors an existing one, and updates the build config.

**Good:** Three separate commits — one for each change.

### Rule 2: Keep It Compilable

After each increment, the project must build and existing tests must pass. Don't leave the codebase in a broken state between slices.

### Rule 3: Feature Flags for Incomplete Features

If a feature isn't ready for users but you need to merge increments:

```typescript
// Feature flag for work-in-progress
const ENABLE_TASK_SHARING = process.env.FEATURE_TASK_SHARING === 'true';

if (ENABLE_TASK_SHARING) {
  // New sharing UI
}
```

This lets you merge small increments to the main branch without exposing incomplete work.

### Rule 4: Safe Defaults

New code should default to safe, conservative behavior:

```typescript
// Safe: disabled by default, opt-in
export function createTask(data: TaskInput, options?: { notify?: boolean }) {
  const shouldNotify = options?.notify ?? false;
  // ...
}
```

### Rule 5: Rollback-Friendly

Each increment should be independently revertable:

- Additive changes (new files, new functions) are easy to revert
- Modifications to existing code should be minimal and focused
- Database migrations should have corresponding rollback migrations
- Avoid deleting something in one commit and replacing it in the same commit — separate them

## Working with Agents

When directing an agent to implement incrementally:

```
"Let's implement Task 3 from the plan.

Start with just the database schema change and the API endpoint.
Don't touch the UI yet — we'll do that in the next increment.

After implementing, run `npm test` and `npm run build` to verify
nothing is broken."
```

Be explicit about what's in scope and what's NOT in scope for each increment.

## Increment Checklist

After each increment, verify:

- [ ] The change does one thing and does it completely
- [ ] All existing tests still pass (`npm test`)
- [ ] The build succeeds (`npm run build`)
- [ ] Type checking passes (`npx tsc --noEmit`)
- [ ] Linting passes (`npm run lint`)
- [ ] The new functionality works as expected
- [ ] The change is committed with a descriptive message

**Note:** Run each verification command after a change that could affect it. After a successful run, don't repeat the same command unless the code has changed since — re-running on unchanged code adds no information.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll test it all at the end" | Bugs compound. A bug in Slice 1 makes Slices 2-5 wrong. Test each slice. |
| "It's faster to do it all at once" | It *feels* faster until something breaks and you can't find which of 500 changed lines caused it. |
| "These changes are too small to commit separately" | Small commits are free. Large commits hide bugs and make rollbacks painful. |
| "I'll add the feature flag later" | If the feature isn't complete, it shouldn't be user-visible. Add the flag now. |
| "This refactor is small enough to include" | Refactors mixed with features make both harder to review and debug. Separate them. |
| "Let me run the build command again just to be sure" | After a successful run, repeating the same command adds nothing unless the code has changed since. Run it again after subsequent edits, not as reassurance. |

## Red Flags

- More than 100 lines of code written without running tests
- Multiple unrelated changes in a single increment
- "Let me just quickly add this too" scope expansion
- Skipping the test/verify step to move faster
- Build or tests broken between increments
- Large uncommitted changes accumulating
- Building abstractions before the third use case demands it
- Touching files outside the task scope "while I'm here"
- Creating new utility files for one-time operations
- Running the same build/test command twice in a row without any intervening code change

## Verification

After completing all increments for a task:

- [ ] Each increment was individually tested and committed
- [ ] The full test suite passes
- [ ] The build is clean
- [ ] The feature works end-to-end as specified
- [ ] The task-level review found no blocking issues
- [ ] The whole-change verification loop has run after all selected tasks
- [ ] No uncommitted changes remain
