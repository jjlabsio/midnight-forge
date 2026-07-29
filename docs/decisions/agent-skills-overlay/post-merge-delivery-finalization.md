# Defer Delivery Completion Until Merge

## Status

Superseded for task-state, lock, and finalization representation by task 0103
on 2026-07-29. It remains historical context only; the active finalization
contract is [MDF Task System](../../architecture/mdf-task-system.md) and the
generated `github-after-merge` skill.

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
- Require `github-pr` to record one explicit task-card link containing only the
  GitHub repository and PR number. A later update to that same PR never
  rewrites the link or creates a delivery artifact. `github-after-merge`
  resolves task identity from an explicit task ID plus that link, or from one
  unique matching link; branch names and PR text alone never establish task
  identity.
- Verify the merged PR directly from GitHub: its final head's required checks,
  default-base target, and merge commit are current source-of-truth facts. Git
  verifies that the default branch contains the reported merge commit. Do not
  retain or compare a pre-merge head, base, checks, mergeability, conflict, or
  local-tree snapshot. Custom base branches are unsupported.
- Treat GitHub CLI's explicit `no required checks reported` result from
  `gh pr checks --required` as a distinct successful lookup state, not a
  provider failure. Only in that state, query the merged PR's related checks;
  every related check must be terminal and passing before finalization may
  proceed. When required checks are reported, retain the required-check policy.
  Pending, failing, malformed, CLI/API, or authentication results in either
  lookup remain finalization blockers.
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
