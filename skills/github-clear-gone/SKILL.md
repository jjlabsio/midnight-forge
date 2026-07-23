---
name: github-clear-gone
description: "Clean up gone Git branches and worktrees after their ownership is released."
---

# github-clear-gone

Use as a standalone cleanup request or as the cleanup phase of
`github-after-merge`.

1. Inspect `git branch -v` and `git worktree list`.
2. Identify branches marked `[gone]` and their associated worktrees.
3. Read all canonical MDF locks. Exclude every branch or worktree referenced
   by an active lock; a gone marker never authorizes bypassing ownership.
4. Show the exact clean candidates. Remove clean worktrees without force, then
   delete every eligible `[gone]` branch with `git branch -D`. This rule is
   independent of ancestry, squash/rebase history, or whether the branch is
   the merged PR branch. Never discard dirty changes implicitly.
5. For dirty candidates, stop and request confirmation naming the exact path,
   branch, and changes that would be discarded.
6. Report removed worktrees and branches, skipped locked candidates, and any
   confirmation still required.

Stop for ambiguous branch/worktree ownership, malformed lock state, unsafe
paths, the canonical/current checkout as a target, or a failed cleanup
operation. Do not mutate task cards, indexes, or locks; the parent post-merge
finalizer releases ownership before this skill runs.
