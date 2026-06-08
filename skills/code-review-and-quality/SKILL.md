---
name: code-review-and-quality
description: Conducts multi-axis code review. Use before merging any change. Use when reviewing code written by yourself, another agent, or a human. Use when you need to assess code quality across multiple dimensions before it enters the main branch.
---

# Code Review and Quality

When saving a code review report, verify MDF user and project init state, resolve the current MDF work item, and write `.mdf/work/{work_id}/review-NNN.md`. If init state is missing, stop and instruct the user to run `mdf init`. Repeated saves create new revisions and update `item.md` `latest.review` plus `.mdf/index.jsonl`.

## Overview

Multi-dimensional code review with quality gates. Every change gets reviewed before merge — no exceptions. MDF-managed work runs spec-compliance review before code-quality review. Code-quality review covers five axes: correctness, readability, architecture, security, and performance.

Before writing review findings, explanations, or recommendations, follow `../../references/human-facing-language.md`. Use the explicit `human_language` preference for human-facing prose while preserving fixed labels, file paths, code identifiers, commands, and MDF artifact paths.

**The approval standard:** Approve a change when it definitely improves overall code health, even if it isn't perfect. Perfect code doesn't exist — the goal is continuous improvement. Don't block a change because it isn't exactly how you would have written it. If it improves the codebase and follows the project's conventions, approve it.

## When to Use

- Before merging any PR or change
- After completing a feature implementation
- When another agent or model produced code you need to evaluate
- When refactoring existing code
- After any bug fix (review both the fix and the regression test)

## Review Scopes

Use the same review engine for task, whole-build, and standalone reviews. The selected scope constrains which evidence matters, which requirements apply, and which findings are blockers.

- `task` scope: review the current task-sized diff against that task's acceptance criteria, task build artifact, high-risk implementation meaning, and verification evidence. Block on issues that prevent the task from satisfying its plan criteria, break nearby behavior, contradict actual tests or code paths, or make the task unsafe to commit.
- `whole-build` scope: review all selected build changes against the approved spec, implementation plan, task artifacts, and final whole-build build artifact. Block on missed spec coverage, integration regressions between completed tasks, missing high-risk evidence, failed or missing full verification, and contradictions with the planned workflow.
- `standalone` scope: review the current diff, staged changes, working tree, PR, or user-specified artifact independently. When a current MDF work item exists, use available MDF spec, plan, and build artifacts for spec-compliance context. Without MDF artifacts, fall back to the existing five-axis review behavior. Use this for user-requested `$review`, manual changes, debugging, PR preparation, merge readiness, and pre-ship checks.

Build-internal reviews and standalone reviews must not use separate review logic. They share this skill's correctness, readability, architecture, security, and performance criteria; scope constrains which evidence matters and which blockers must be fixed before continuing.

## Build-Internal Review Artifacts

For `$mdf:build` task and whole-build review gates, save a separate `.mdf/work/{work_id}/review-NNN.md` artifact. A review summary inside `build-NNN.md` may link to or summarize the review artifact, but it does not satisfy the review gate.

Task and whole-build review artifacts must use this structure:

```markdown
## Verdict

Verdict: PASS | REQUEST CHANGES

## Scope

- Scope: task | whole-build
- Build artifact reviewed: `.mdf/work/{work_id}/build-NNN.md`
- Diff reviewed: [commit, staged diff, or file list]

## Requirement Checks

| Requirement | Evidence Checked | Code Path Checked | Result |
| --- | --- | --- | --- |
| [criterion text] | [test/check/artifact] | [file/function/path] | pass/fail |

## Findings

## Fix Loop

## Freshness
```

`Verdict: PASS` is allowed only when there are no blocking findings. Critical and Important findings are blocking for build-internal reviews unless the artifact explains why the finding is out of scope for the selected review gate.

Task-scope review artifacts must cover every task acceptance criterion and every task-assigned high-risk semantic criterion. Whole-build review artifacts must cover every approved spec requirement, or an explicitly grouped equivalent that preserves full coverage and makes omitted requirements visible.

`Fix Loop` records the review loop state. If blockers were found, include the blocking review artifact, the fix summary, the verification rerun, any updated build evidence, and the later passing review artifact that references or supersedes the blocking review. If no blockers were found, record that no fix loop was required.

Record freshness honestly:

- `Freshness: same-agent inline review` for ordinary task or whole-build reviews performed by the same agent in the current build flow.
- `Freshness: standalone-like inline pass` for high-risk independent review when fresh-context or subagent review is unavailable or unauthorized.
- `Freshness: fresh-context subagent` or another fresh-context/subagent value only when the current user explicitly authorized subagents, delegation, or parallel agent work and the runtime actually used that mechanism.

Do not claim fresh-context, subagent, delegated, or independent freshness because the prompt asked for review. The freshness value must describe what actually happened.

## Pass 1: Spec Compliance

Run this pass first for MDF-managed work: `task`, `whole-build`, and `standalone` when MDF artifacts are available.

The spec-compliance pass checks whether the implementation actually satisfies the approved requirement, not whether the implementation summary sounds plausible. Distrust implementer and build summaries until actual tests, evidence, and code paths have been inspected.

If Pass 1 finds Critical or Important issues showing that the implementation does not satisfy the spec, task acceptance criteria, high-risk implementation meaning, or required scenarios, stop and report those blockers before continuing to Pass 2. Do not approve code quality while spec compliance is still wrong.

For `task` scope, compare:

- The current task diff
- The task build artifact and `Task Acceptance Traceability`
- The task acceptance criteria
- High-risk implementation meaning, required scenarios, and negative scenarios assigned to the task
- Task verification evidence, including RED/GREEN evidence and reviewed code paths

For `whole-build` scope, compare:

- All selected build changes
- The final whole-build build artifact and `Whole-Build Spec Traceability`
- The approved spec
- The full implementation plan
- Task-level build artifacts
- Integration behavior across completed tasks

For artifact-backed `standalone` scope, use available MDF spec, plan, and build artifacts to run the same compliance checks that fit the current diff or review request. If no MDF artifacts are available, skip Pass 1 and proceed with the existing five-axis review behavior.

Block on:

- Missed spec coverage or missing task acceptance coverage
- Weakened high-risk semantics, such as relying on later external wake-up or recovery for a same-invocation guarantee
- Missing high-risk traceability evidence
- RED/GREEN evidence that does not test the required behavior
- Code paths that contradict the build artifact or plan claims
- Missing required or negative scenarios for high-risk requirements
- Contradictions between approved spec, plan, build artifacts, tests, and actual code

## High-Risk Independent Review

Use this review mode when `$mdf:build` reaches the mandatory high-risk independent review gate. The gate applies when the plan contains at least one high-risk requirement or build discovers a new high-risk semantic concern.

Scope this review narrowly to high-risk semantic compliance:

- Approved spec high-risk requirement text
- Plan classification reason and implementation meaning
- Required scenarios and negative scenarios
- Task build artifact RED/GREEN/code-path evidence
- Final whole-build traceability
- Actual changed code paths

Prefer fresh-context or subagent review only when the current user request explicitly authorizes subagents, delegation, or parallel agent work and the runtime exposes the needed tools. If that is unavailable or unauthorized, run a standalone-like inline pass with this same review engine. Do not skip the gate because fresh-context review is unavailable.

The review artifact must include:

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

Record freshness explicitly, for example `Freshness: fresh-context subagent` or `Freshness: standalone-like inline pass`.

Block on:

- Missing traceability evidence
- RED/GREEN evidence that does not test the required behavior
- Code paths that contradict build claims
- Missing required or negative scenarios
- Weakened semantics, such as relying on later external wake-up or recovery for an internal-loop guarantee
- Any Critical or Important finding

## Pass 2: Code Quality / Five-Axis Review

Every review evaluates code across these dimensions:

### 1. Correctness

Does the code do what it claims to do?

- Does it match the spec or task requirements?
- Are edge cases handled (null, empty, boundary values)?
- Are error paths handled (not just the happy path)?
- Does it pass all tests? Are the tests actually testing the right things?
- Are there off-by-one errors, race conditions, or state inconsistencies?

### 2. Readability & Simplicity

Can another engineer (or agent) understand this code without the author explaining it?

- Are names descriptive and consistent with project conventions? (No `temp`, `data`, `result` without context)
- Is the control flow straightforward (avoid nested ternaries, deep callbacks)?
- Is the code organized logically (related code grouped, clear module boundaries)?
- Are there any "clever" tricks that should be simplified?
- **Could this be done in fewer lines?** (1000 lines where 100 suffice is a failure)
- **Are abstractions earning their complexity?** (Don't generalize until the third use case)
- Would comments help clarify non-obvious intent? (But don't comment obvious code.)
- Are there dead code artifacts: no-op variables (`_unused`), backwards-compat shims, or `// removed` comments?

### 3. Architecture

Does the change fit the system's design?

- Does it follow existing patterns or introduce a new one? If new, is it justified?
- Does it maintain clean module boundaries?
- Is there code duplication that should be shared?
- Are dependencies flowing in the right direction (no circular dependencies)?
- Is the abstraction level appropriate (not over-engineered, not too coupled)?

### 4. Security

For detailed security guidance, see `security-and-hardening`. Does the change introduce vulnerabilities?

- Is user input validated and sanitized?
- Are secrets kept out of code, logs, and version control?
- Is authentication/authorization checked where needed?
- Are SQL queries parameterized (no string concatenation)?
- Are outputs encoded to prevent XSS?
- Are dependencies from trusted sources with no known vulnerabilities?
- Is data from external sources (APIs, logs, user content, config files) treated as untrusted?
- Are external data flows validated at system boundaries before use in logic or rendering?

### 5. Performance

For detailed profiling and optimization, see `performance-optimization`. Does the change introduce performance problems?

- Any N+1 query patterns?
- Any unbounded loops or unconstrained data fetching?
- Any synchronous operations that should be async?
- Any unnecessary re-renders in UI components?
- Any missing pagination on list endpoints?
- Any large objects created in hot paths?

## Change Sizing

Small, focused changes are easier to review, faster to merge, and safer to deploy. Target these sizes:

```
~100 lines changed   → Good. Reviewable in one sitting.
~300 lines changed   → Acceptable if it's a single logical change.
~1000 lines changed  → Too large. Split it.
```

**What counts as "one change":** A single self-contained modification that addresses one thing, includes related tests, and keeps the system functional after submission. One part of a feature — not the whole feature.

**Splitting strategies when a change is too large:**

| Strategy | How | When |
|----------|-----|------|
| **Stack** | Submit a small change, start the next one based on it | Sequential dependencies |
| **By file group** | Separate changes for groups needing different reviewers | Cross-cutting concerns |
| **Horizontal** | Create shared code/stubs first, then consumers | Layered architecture |
| **Vertical** | Break into smaller full-stack slices of the feature | Feature work |

**When large changes are acceptable:** Complete file deletions and automated refactoring where the reviewer only needs to verify intent, not every line.

**Separate refactoring from feature work.** A change that refactors existing code and adds new behavior is two changes — submit them separately. Small cleanups (variable renaming) can be included at reviewer discretion.

## Change Descriptions

Every change needs a description that stands alone in version control history.

**First line:** Short, imperative, standalone. "Delete the FizzBuzz RPC" not "Deleting the FizzBuzz RPC." Must be informative enough that someone searching history can understand the change without reading the diff.

**Body:** What is changing and why. Include context, decisions, and reasoning not visible in the code itself. Link to bug numbers, benchmark results, or design docs where relevant. Acknowledge approach shortcomings when they exist.

**Anti-patterns:** "Fix bug," "Fix build," "Add patch," "Moving code from A to B," "Phase 1," "Add convenience functions."

## Review Process

### Step 1: Understand the Context

Before looking at code, understand the intent:

```
- What is this change trying to accomplish?
- What spec or task does it implement?
- What is the expected behavior change?
```

### Step 2: Review the Tests First

Tests reveal intent and coverage:

```
- Do tests exist for the change?
- Do they test behavior (not implementation details)?
- Are edge cases covered?
- Do tests have descriptive names?
- Would the tests catch a regression if the code changed?
```

### Step 3: Review the Implementation

Walk through the code with the five axes in mind:

```
For each file changed:
1. Correctness: Does this code do what the test says it should?
2. Readability: Can I understand this without help?
3. Architecture: Does this fit the system?
4. Security: Any vulnerabilities?
5. Performance: Any bottlenecks?
```

### Step 4: Categorize Findings

Label every comment with its severity so the author knows what's required vs optional:

| Prefix | Meaning | Author Action |
|--------|---------|---------------|
| *(no prefix)* | Required change | Must address before merge |
| **Critical:** | Blocks merge | Security vulnerability, data loss, broken functionality |
| **Nit:** | Minor, optional | Author may ignore — formatting, style preferences |
| **Optional:** / **Consider:** | Suggestion | Worth considering but not required |
| **FYI** | Informational only | No action needed — context for future reference |

This prevents authors from treating all feedback as mandatory and wasting time on optional suggestions.

### Step 5: Verify the Verification

Check the author's verification story:

```
- What tests were run?
- Did the build pass?
- Was the change tested manually?
- Are there screenshots for UI changes?
- Is there a before/after comparison?
```

## Multi-Model Review Pattern

Use different models for different review perspectives:

```
Model A writes the code
    │
    ▼
Model B reviews for correctness and architecture
    │
    ▼
Model A addresses the feedback
    │
    ▼
Human makes the final call
```

This catches issues that a single model might miss — different models have different blind spots.

**Example prompt for a review agent:**
```
Review this code change for correctness, security, and adherence to
our project conventions. The spec says [X]. The change should [Y].
Flag any issues as Critical, Important, or Suggestion.
```

## Dead Code Hygiene

After any refactoring or implementation change, check for orphaned code:

1. Identify code that is now unreachable or unused
2. List it explicitly
3. **Ask before deleting:** "Should I remove these now-unused elements: [list]?"

Don't leave dead code lying around — it confuses future readers and agents. But don't silently delete things you're not sure about. When in doubt, ask.

```
DEAD CODE IDENTIFIED:
- formatLegacyDate() in src/utils/date.ts — replaced by formatDate()
- OldTaskCard component in src/components/ — replaced by TaskCard
- LEGACY_API_URL constant in src/config.ts — no remaining references
→ Safe to remove these?
```

## Review Speed

Slow reviews block entire teams. The cost of context-switching to review is less than the waiting cost imposed on others.

- **Respond within one business day** — this is the maximum, not the target
- **Ideal cadence:** Respond shortly after a review request arrives, unless deep in focused coding. A typical change should complete multiple review rounds in a single day
- **Prioritize fast individual responses** over quick final approval. Quick feedback reduces frustration even if multiple rounds are needed
- **Large changes:** Ask the author to split them rather than reviewing one massive changeset

## Handling Disagreements

When resolving review disputes, apply this hierarchy:

1. **Technical facts and data** override opinions and preferences
2. **Style guides** are the absolute authority on style matters
3. **Software design** must be evaluated on engineering principles, not personal preference
4. **Codebase consistency** is acceptable if it doesn't degrade overall health

**Don't accept "I'll clean it up later."** Experience shows deferred cleanup rarely happens. Require cleanup before submission unless it's a genuine emergency. If surrounding issues can't be addressed in this change, require filing a bug with self-assignment.

## Honesty in Review

When reviewing code — whether written by you, another agent, or a human:

- **Don't rubber-stamp.** "LGTM" without evidence of review helps no one.
- **Don't soften real issues.** "This might be a minor concern" when it's a bug that will hit production is dishonest.
- **Quantify problems when possible.** "This N+1 query will add ~50ms per item in the list" is better than "this could be slow."
- **Push back on approaches with clear problems.** Sycophancy is a failure mode in reviews. If the implementation has issues, say so directly and propose alternatives.
- **Accept override gracefully.** If the author has full context and disagrees, defer to their judgment. Comment on code, not people — reframe personal critiques to focus on the code itself.

## Dependency Discipline

Part of code review is dependency review:

**Before adding any dependency:**
1. Does the existing stack solve this? (Often it does.)
2. How large is the dependency? (Check bundle impact.)
3. Is it actively maintained? (Check last commit, open issues.)
4. Does it have known vulnerabilities? (`npm audit`)
5. What's the license? (Must be compatible with the project.)

**Rule:** Prefer standard library and existing utilities over new dependencies. Every dependency is a liability.

## The Review Checklist

```markdown
## Review: [PR/Change title]

### Context
- [ ] I understand what this change does and why

### Correctness
- [ ] Change matches spec/task requirements
- [ ] Edge cases handled
- [ ] Error paths handled
- [ ] Tests cover the change adequately

### Readability
- [ ] Names are clear and consistent
- [ ] Logic is straightforward
- [ ] No unnecessary complexity

### Architecture
- [ ] Follows existing patterns
- [ ] No unnecessary coupling or dependencies
- [ ] Appropriate abstraction level

### Security
- [ ] No secrets in code
- [ ] Input validated at boundaries
- [ ] No injection vulnerabilities
- [ ] Auth checks in place
- [ ] External data sources treated as untrusted

### Performance
- [ ] No N+1 patterns
- [ ] No unbounded operations
- [ ] Pagination on list endpoints

### Verification
- [ ] Tests pass
- [ ] Build succeeds
- [ ] Manual verification done (if applicable)

### Verdict
- [ ] **Approve** — Ready to merge
- [ ] **Request changes** — Issues must be addressed
```
## See Also

- For detailed security review guidance, see `references/security-checklist.md`
- For performance review checks, see `references/performance-checklist.md`

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It works, that's good enough" | Working code that's unreadable, insecure, or architecturally wrong creates debt that compounds. |
| "I wrote it, so I know it's correct" | Authors are blind to their own assumptions. Every change benefits from another set of eyes. |
| "We'll clean it up later" | Later never comes. The review is the quality gate — use it. Require cleanup before merge, not after. |
| "AI-generated code is probably fine" | AI code needs more scrutiny, not less. It's confident and plausible, even when wrong. |
| "The tests pass, so it's good" | Tests are necessary but not sufficient. They don't catch architecture problems, security issues, or readability concerns. |

## Red Flags

- PRs merged without any review
- Review that only checks if tests pass (ignoring other axes)
- "LGTM" without evidence of actual review
- Security-sensitive changes without security-focused review
- Large PRs that are "too big to review properly" (split them)
- No regression tests with bug fix PRs
- Review comments without severity labels — makes it unclear what's required vs optional
- Accepting "I'll fix it later" — it never happens

## Verification

After review is complete:

- [ ] All Critical issues are resolved
- [ ] All Important issues are resolved or explicitly deferred with justification
- [ ] Tests pass
- [ ] Build succeeds
- [ ] The verification story is documented (what changed, how it was verified)
