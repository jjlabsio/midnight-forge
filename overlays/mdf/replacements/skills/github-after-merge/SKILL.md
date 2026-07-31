---
name: github-after-merge
description: "Finalize a merged GitHub PR, complete its MDF task, and clean up gone branches."
---

# github-after-merge

## Upstream contract

This is an `mdf-only` finalizer, not an adapter for an upstream command. Its
task-state and local-worktree rules are MDF adaptations; no upstream finalizer
or cleanup contract is replaced.

## MDF adaptation

This is the user-facing post-merge finalizer. It uses the current task store
and then loads `github-clear-gone`; it never recreates the retired index or
lock lifecycle.

## Managed finalization

1. Resolve the canonical root and one current task with status `active` or
   `done` by explicit ID or its unique `task.json.latest.pr` link. Never infer
   identity from a branch name. Require
   that link to equal `{ "repository": "<owner>/<repo>", "number": <positive
   integer> }` and match the requested PR.
2. Run `<skill-root>/scripts/post-merge-facts.mjs <owner/repo> <positive-pr-number>`.
   It verifies the merged PR, default base, merge commit, and final-head checks.
   When GitHub explicitly reports no required checks, it verifies that every
   related check is terminal and passing instead. Any other provider failure,
   malformed result, pending check, or failed check stops finalization.
3. Fetch the default branch and require its remote tip to contain the reported
   merge commit. Custom bases are unsupported.
4. Re-read current task state through the task-store helper. For `active`, use
   its digest-guarded expected-content replacement to set only `status: done`,
   retaining the task's identity, intent, artifacts, branch, worktree, and PR
   link. For `done`, verify the same merged-PR evidence and finish as a no-op.
   Stop for any other status or changed state.
5. Only after the `done` transition or verified `done` no-op, best-effort
   synchronize existing local default-branch worktrees before cleanup:
   - Use the verified default branch from step 2 and the fetched ref from step
     3. Resolve its exact fetched tip with
     `git rev-parse --verify "refs/remotes/origin/<default-branch>^{commit}"`.
   - Parse `git worktree list --porcelain`. A candidate is only a worktree
     stanza with `branch refs/heads/<default-branch>`; do not infer candidates
     from a directory name, a detached HEAD, or another branch.
   - For each candidate, run `git -C <worktree-path> status --porcelain`.
     Any output means it is dirty: report that worktree as skipped and do not
     update it. If there is no candidate, report synchronization skipped.
   - Before updating a clean candidate, require
     `git -C <worktree-path> merge-base --is-ancestor HEAD <fetched-tip>`.
     If it fails, the checked-out branch cannot fast-forward to the fetched
     tip: report it skipped and do not update it.
   - For an eligible candidate, run only
     `git -C <worktree-path> merge --ff-only <fetched-tip>`, then require its
     `HEAD` to equal `<fetched-tip>`. Never checkout another branch, reset,
     rebase, force-update, or discard changes. A failed command or failed
     postcondition is partial synchronization, not a reason to change task
     state.
6. Continue to load `github-clear-gone` for its normal standalone
   synchronization and cleanup contract regardless of skipped or partial local
   synchronization. Failed cleanup reports partial completion and never
   reopens the task.

## Synchronization-only

Without an explicit task ID or one unique matching current-state PR link, do
not mutate task state. Verify the merged PR through the same facts helper and
run only the applicable `github-clear-gone` synchronization/cleanup path.

Report the merged PR, verified head/base/check facts, finalization result, and
cleanup result. Merge, push, PR mutation, deploy, and unrelated cleanup remain
outside this skill's authority.
