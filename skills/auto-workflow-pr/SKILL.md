---
name: auto-workflow-pr
description: "Run MDF's complete implementation, ship, commit, push, and GitHub PR workflow."
---

# auto-workflow-pr

This is the PR-capable successor to the former `auto-workflow` skill. It keeps
the existing end-to-end behavior while adding a continuation path for work
that was already implemented through repeated `auto-workflow` invocations.

Load `../../references/auto-workflow-contract.md` and use
`mode: auto-workflow-pr` for downstream skills. This is the only auto mode in
this split that grants push and PR create/update authority after fresh
preflight. It never authorizes merge, deploy, deletion, stale-lock takeover,
force operations, or unrelated cleanup.

## Lifecycle

The full lifecycle is:

```text
intent preflight -> interview-me when required -> spec -> plan ->
build/test -> task review -> whole-build review -> code-simplify -> commit ->
ship -> final PR preflight -> whole MDF task completion/lock release -> push
-> github-pr create/update
```

Reuse current approved artifacts, commits, review evidence, and handoff facts
when they are still valid. A changed intent, spec, plan, scope, task order, or
code tree invalidates the affected downstream evidence and requires the
corresponding implementation or review work again.

## Continuation paths

At the start of the run, resolve exactly one task, its canonical work item,
branch, worktree, lock, current Git state, and latest spec/plan revisions.

### Pending plan work

If the approved plan has pending implementation slices, run the local
implementation loop first:

```text
build/test -> task review -> whole-build review -> code-simplify -> commit
```

Do not treat a plan-slice commit as completion of the whole MDF task.
After each completed slice, re-read the canonical plan and task card. Repeat
the local loop until every approved slice is complete; only then continue to
ship.

### No pending plan work

This is a valid finalization state, not a stop. Do not invent more
implementation work and do not ignore the spec. Use the latest approved spec as
the complete acceptance and scope baseline, use the plan and prior evidence to
confirm that all implementation slices are covered, then continue with:

```text
latest verification/evidence check -> ship -> final PR preflight -> whole MDF
task completion/lock release -> push -> github-pr create/update
```

If the current code or scope changed after the last review, rerun the affected
tests and review before ship. If spec, plan, task ownership, or branch facts
are missing or ambiguous, stop rather than guessing.

For the first meaningful vertical slice, preserve the former workflow's
consumer checkpoint: validate the actual browser consumer for UI changes, or
the real CLI/API/integration boundary for other changes, and attach runtime
evidence. Add a minimal critical-flow E2E smoke path when the changed behavior
has a critical user flow. Apply the existing bounded reviewer fan-out and
defensive parallel-writer rules; unknown independence facts remain serial.

## Intent and spec

Apply the same mandatory intent preflight as the former auto workflow. Invoke
`interview-me` for missing intent fields, materially different interpretations,
unsurfaced assumptions, conflicting optimization goals, confidence below 95%,
or an explicit interview request. Reuse a settled handoff only when the
current scope is unchanged.

Spec is never a disposable setup artifact. Even with no pending plan work, use
the latest approved spec for final review, ship readiness, scope checking, and
PR content. Map every acceptance criterion to current verification or review
evidence before declaring the plan complete. A changed spec requires a new
compatible plan revision before implementation or delivery continues.

## Whole task completion and PR handoff

`plan task complete` means its tests, build, review, simplification, and local
commit passed. `MDF task done` means the complete work item is ready for final
delivery. The implementation loop commits intended changes before ship. After
ship returns GO, perform the fresh branch, remote, mergeability,
authentication, clean-tree, and open-PR preflight while the active lock is
still held. If that preflight finds intended uncommitted changes, use
`github-commit`, rerun the affected review/ship checks, and repeat the
preflight. Only after it passes, perform the task skill's normal completion
mutation and release the lock; then push and create or update the PR. Do not
complete the task before the final preflight passes.

Push the current branch, update the matching open PR when one exists, or
create one when none exists. Query GitHub before retrying an uncertain create
result so duplicate PRs cannot be created. After the PR URL or failure is
recorded, stop; do not merge, deploy, delete, or clean up branches/worktrees.

## Review and safety

Review is mandatory. Use the central dispatch policy for bounded independent
reports when user impact, risk, or uncertainty warrants them. The root agent
owns synthesis, task completion, ship decision, commit scope, and external
mutation. Stop for unresolved intent, high-risk decisions, failed verification,
ship NO-GO, lock/worktree/branch conflicts, dirty unrelated changes, missing
GitHub authority, unmergeable base, or failed/ambiguous push or PR mutation.
