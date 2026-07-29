---
name: github-clear-gone
description: "Clean up gone Git branches and worktrees after their ownership is released."
---

# github-clear-gone

Use as a standalone cleanup request or as the cleanup phase of
`github-after-merge`.

1. Run `git fetch origin --prune` to refresh remote-tracking branch deletion
   state. Stop if it fails.
2. Inspect `git branch -v` and `git worktree list`.
3. Identify branches marked `[gone]` and their associated worktrees.
4. Run the task-store helper's read-only `list` operation for the canonical
   root. Exclude every branch or worktree recorded by an `active` task; a gone
   marker never authorizes bypassing active task ownership.
5. Show the exact clean candidates. Remove clean worktrees without force, then
   delete every eligible `[gone]` branch with `git branch -D`. This rule is
   independent of ancestry, squash/rebase history, or whether the branch is
   the merged PR branch. Never discard dirty changes implicitly.
6. For dirty candidates, stop and request confirmation naming the exact path,
   branch, and changes that would be discarded.
7. Report removed worktrees and branches, skipped active-task candidates, and any
   confirmation still required.

Stop for ambiguous branch/worktree ownership, malformed current task state, unsafe
paths, the canonical/current checkout as a target, or a failed cleanup
operation. Do not mutate task state; the parent post-merge finalizer records
`done` before this skill runs.
