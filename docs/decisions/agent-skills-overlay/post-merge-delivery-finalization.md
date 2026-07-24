# Defer Delivery Completion Until Merge

## Status

Accepted

## Date

2026-07-22

## Context

PR creation and passing consumer gates prove delivery readiness, not that the
change has entered the target branch. Completing a delivery task at that point
releases its lock before the user merges the PR and makes the task board claim
that development is finished while the change is still pending external
integration.

The user also needs one post-merge command. Requiring separate `task` and
`github-clear-gone` invocations would make `github-after-merge` an incomplete
entrypoint.

## Decision

- Keep delivery tasks `active` with their matching lock through PR creation,
  consumer checks, mergeability, and the user's merge action.
- Make `github-after-merge` the single user-facing post-merge composite. It
  verifies the exact merged PR revision, applies the canonical `task`
  post-merge finalization contract, then loads `github-clear-gone` after lock
  release. Invoke it explicitly as a separate operation after merge; delivery
  workflows do not wait for the merge or resume to run it.
- Require a root-authored delivery handoff containing repository, PR identity,
  accepted head OID, expected base, checks, and task/work/lock references.
  Branch names or PR text alone never establish task identity.
- Make finalization interruption-safe: `active + matching lock` completes the
  card and projection before conditional lock release; `done + matching lock`
  verifies and releases the exact lock; `done + no lock` is a verified no-op;
  every other combination blocks.
- Keep synchronization and branch/worktree cleanup after finalization. Cleanup
  excludes every active lock and never discards dirty work without explicit
  confirmation. Every remaining eligible `[gone]` branch is deleted with
  `git branch -D` after any associated clean worktree is removed; ancestry and
  the merged PR identity do not narrow that cleanup rule.
- Keep local-only, taskless, and already-completed read-only handoffs outside
  this delivery finalization path.

## Consequences

Dependent tasks remain blocked until the PR is merged, which matches the
meaning of a delivery dependency but increases review-latency coupling.
Abandoned or closed-unmerged PRs require an explicit recovery or task-drop
decision; they never release ownership automatically. Local default-branch
synchronization failure after successful finalization is reported as partial
cleanup and does not reopen the completed task.
