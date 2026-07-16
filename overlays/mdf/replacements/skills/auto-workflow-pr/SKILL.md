---
name: auto-workflow-pr
description: "Run MDF's complete implementation, ship, commit, push, and GitHub PR workflow."
---

# auto-workflow-pr

This is the PR-capable successor to the former `auto-workflow` skill. It keeps
the existing end-to-end behavior while adding a continuation path for work
that was already implemented through repeated `auto-workflow` invocations.

Load `../../references/auto-workflow-contract.md` and use
`mode: auto-workflow-pr` for downstream skills. The contract is the single
source of truth for the shared auto-mode middle stages. This is the only auto
mode in this split that grants push and PR create/update authority after fresh
preflight. It never authorizes merge, deploy, deletion, stale-lock takeover,
force operations, or unrelated cleanup.

## Delivery lifecycle boundary

Follow the shared auto-mode middle-stage lifecycle in the loaded contract.
After its final local commit/handoff is current, this entrypoint continues
through ship, final PR preflight, whole-task completion and lock release, push,
and GitHub PR create/update.

## Continuation paths

At the start of the run, resolve exactly one task, its canonical work item,
branch, worktree, lock, current Git state, and latest spec/plan revisions.

### Pending plan work

If the approved plan has pending implementation slices, run the local
implementation loop defined by the shared contract first.

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

## Delivery safety

The shared contract's review, verification, freshness, and stop rules remain
mandatory. This delivery entrypoint additionally stops for ship NO-GO,
lock/worktree/branch conflicts, dirty unrelated changes, missing GitHub
authority, unmergeable base, or failed/ambiguous push or PR mutation.
