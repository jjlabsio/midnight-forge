---
name: github-after-merge
description: "Finalize a merged GitHub PR, complete its MDF task, and clean up gone branches."
---

# github-after-merge

This is the user-facing post-merge finalizer. One invocation composes the
`task` post-merge finalization contract and `github-clear-gone`; the user does
not need to invoke either skill separately.

## Preconditions

1. Require an explicit PR number or URL. A bare request to sync after merge
   without an exact task ID or task-card PR link is synchronization-only and
   must not mutate MDF task state.
2. Resolve the canonical root and read GitHub as the source of truth. Common
   merge verification requires repository, PR number, URL, `mergedAt`,
   `headRefOid`, and `baseRefName`.
3. Select one path before task resolution:
   - Managed finalization: an explicit task ID is present, or exactly one task
     card has a matching `latest.pr` link. Resolve its exact task/work/lock;
     never infer task identity from a branch name alone.
   - Synchronization-only: no task ID and no unique matching task-card link are
     present. Do not resolve, create, or mutate task state.
4. For managed finalization, require the card link to be exactly
   `{ "repository": "<owner>/<repo>", "number": <positive integer> }` and
   to equal the GitHub repository and requested PR number. A supplied task ID
   still requires this matching stored link. Stop for a missing, malformed,
   ambiguous, or mismatched link; historical delivery files and historical
   string-valued `latest.pr` entries are not migration inputs.
5. For managed finalization, require `mergeCommitOid`; a provider that cannot
   supply it is a stop. Resolve the repository default branch and require the
   merged PR's `baseRefName` to equal it; custom base branches are unsupported.
   Require the latest related or required checks for the merged PR's final
   `headRefOid` to be terminal and passing. After fetching the default branch,
   verify that its remote tip contains the reported merge commit OID.
6. For managed finalization, stop without task mutation or cleanup for an
   unmerged/closed PR, failed or pending final-head checks, non-default base,
   ambiguous linkage, provider failure, lock mismatch, or missing completion
   evidence. Synchronization-only stops only for failed common merge
   verification, unsafe checkout state, or failed cleanup.

## Synchronization-only path

When the synchronization-only path is selected, run the synchronization and
`github-clear-gone` cleanup phases using only the common merge verification;
skip the task-only head/check/base and `mergeCommitOid` requirements and skip
task finalization. This preserves direct sync requests and taskless PR
handoffs. Do not create or mutate task state in this path.

## Finalize the task

After the merged revision passes every precondition, apply the canonical
`task` post-merge delivery finalization in the root context:

1. Re-read the complete card, latest index projection, and exact lock bytes.
2. For `active + matching lock`, write the card as `done`, append one current
   index projection, re-read both, then release the lock conditionally by its
   current byte digest.
3. For `done + matching lock`, treat the operation as interrupted recovery:
   verify the merged-PR evidence, repair or append one unambiguous current index
   projection when the card is authoritative, re-read both, then release only
   that exact lock. Do not replay `done`.
4. For `done + no lock`, finish as an idempotent no-op after verifying the
   merged-PR evidence. Any other state is `BLOCKED`.

If finalization fails, do not clean branches/worktrees and do not recreate or
release a lock through a fallback path.

## Synchronize and clean up

1. The managed path enters this phase after task finalization and lock
   release. The synchronization-only path enters it after common merge
   verification. Resolve the merged PR's target branch. Synchronize the
   canonical checkout only when it is clean, has an `origin`, and the remote
   target can be fast-forwarded safely. Never reset, rebase, overwrite, or
   discard local work.
2. Load `github-clear-gone` internally from the canonical checkout. It owns
   gone-candidate selection, cleanup, and dirty-worktree confirmation; report
   its result without restating or bypassing its contract.
3. If synchronization or cleanup fails after finalization, report partial
   completion. Do not reopen the task or reacquire its lock.

Report the merged PR, verified head/base and checks, task finalization result,
lock result, synchronization result, cleanup result, and any confirmation
still required.

Merge, push, PR mutation, deploy, stale-lock takeover, and unrelated cleanup
remain outside this skill's authority.
