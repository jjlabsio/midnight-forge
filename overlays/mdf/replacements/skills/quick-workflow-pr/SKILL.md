---
name: quick-workflow-pr
description: "Run a direct lightweight implementation, verification, review, and GitHub PR workflow for small documentation or implementation changes."
---

# quick-workflow-pr

Use this skill only when the user has already judged the work small enough to
skip MDF specification and planning artifacts. This is an explicit direct
workflow, not an automatic complexity classifier.

Load `../../references/auto-workflow-contract.md` and use
`mode: quick-workflow-pr` for the downstream `build`, `review`, and
`github-pr` skills. The mode is valid only with the current task, worktree,
branch, lock, and quick handoff established by this invocation.

This workflow always skips `spec` and `plan`. Do not create replacement
artifacts, approval hashes, or a quick-specific copy of an existing MDF skill.
Do not invoke `ship` or `code-simplify`.

## Scope baseline

Use the user's current request, the active task card's Context, the current
branch and HEAD, the intended changed paths, and the verification results as
the acceptance baseline. Record this readable quick handoff under the current
work item. It must state the settled request, current phase, allowed skills,
allowed external actions, assumptions, verification, and remaining work.

If implementation reveals an ambiguous requirement, a public-contract,
security, privacy, permission, destructive, migration, dependency, CI, or
deployment decision, stop. Do not silently create a spec or plan; ask the user
to choose the full workflow or resolve the decision.

## Lifecycle

The lifecycle is:

```text
build -> review -> [actionable findings: build -> verification -> review] ->
github-pr
```

### Build

Invoke the canonical `build` skill with `mode: quick-workflow-pr`. It keeps
the existing upstream implementation discipline and verification criteria.
For behavioral code changes, use the applicable RED/GREEN test loop, run the
relevant regression suite, and run the project build/typecheck/lint checks.
For documentation-only or static-content changes, apply the relevant project
validation without inventing behavioral tests.

The quick mode is one bounded change rather than a plan slice. It must not
generate or require a spec or plan.

### Review loop

Invoke the canonical `review` skill with `mode: quick-workflow-pr` and
`review_mode: task-review`. Review the current diff across all of the existing
review skill's axes: correctness, readability, architecture, security, and
performance. The review is report-only; the root agent owns fixes.

- An actionable finding returns to `build`.
- After every fix, rerun the applicable verification and review the changed
  tree again.
- Suggestions may be accepted or recorded without a second build when they do
  not affect correctness or scope.
- Repeated no-progress, unresolved ambiguity, or scope expansion is a stop.

Do not invoke `code-simplify` as a separate phase.

### GitHub PR handoff

After review passes, invoke the canonical `github-pr` skill with
`mode: quick-workflow-pr`. It retains the full branch, clean-tree,
authentication, mergeability, open-PR, remote-HEAD, push, and duplicate-PR
preflight. Keep the task active and the lock held through push, PR
create/update, latest-head check completion, and mergeability/conflict
validation. If the PR consumer fails, return to the shared evidence,
spec-validity, plan-compatibility, and current-tree reconciliation protocol
and re-enter canonical `build -> review -> commit` on the same task when
source changes. Quick mode does not invent spec/plan artifacts; if recovery
requires a material spec or plan revision, stop and select the full workflow.
Complete the task and release the lock only after the latest PR head passes
all required delivery gates. Do not merge, deploy, delete, or clean up
branches or worktrees.

The PR must truthfully summarize the request, changed files, verification
commands and outcomes, operational impact, rollback, and the fact that
specification and planning artifacts were intentionally skipped by the
explicit quick workflow.

## Stop conditions

Stop for a missing or ambiguous task, mismatched lock/worktree/branch, dirty
unrelated changes, failed verification, unresolved blocking review findings,
repeated no-progress, missing GitHub authority, unmergeable base, or uncertain
push/PR state. A quick workflow is not permission to weaken the canonical
`build`, `review`, or `github-pr` rules.
