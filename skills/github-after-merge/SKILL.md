---
name: github-after-merge
description: "Use after a GitHub PR has been merged to return to the default branch and hand off gone-branch cleanup."
---

# GitHub After Merge

Use this skill only after the user says the PR was merged or explicitly asks
to sync after merge. It owns post-merge local synchronization; it does not
merge PRs, create commits, push, or silently clean branches.

1. Identify the PR from an explicit number or URL, or from the current branch
   with `gh pr view`. Stop if it cannot be identified.
2. Read the PR state and require `mergedAt`, head ref, base ref, and URL to be
   present and mutually consistent. If it is not merged, stop without
   switching branches, pulling, or deleting anything.
3. Resolve the canonical repository checkout. When invoked from a linked
   worktree under `<canonical-root>/.worktrees/<branch>`, use the canonical
   root for default-branch synchronization. Do not create or write MDF task
   state from this skill.
4. Stop if the canonical checkout is dirty, the repository has no `origin`, or
   the remote default branch cannot be resolved.
5. In the canonical checkout, fetch the remote default branch with prune,
   check it out only when safe, and fast-forward it only with
   `git pull --ff-only`. Never reset, rebase, or overwrite local work.
6. Hand off gone-branch candidates to `github-clear-gone`. Show candidates and
   remove only clean gone branches/worktrees automatically; dirty worktrees
   require explicit confirmation naming the path and discarded changes.
7. Report the merged PR URL, default branch and latest commit, synchronization
   result, cleanup result, and any confirmation still required.

Stop on a failed GitHub query, non-merged PR, dirty canonical checkout, failed
checkout/fetch/fast-forward, branch ambiguity, or an unconfirmed dirty cleanup.
