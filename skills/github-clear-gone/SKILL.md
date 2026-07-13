---
name: github-clear-gone
description: "Use when cleaning local Git branches marked gone after remote deletion, with confirmation for dirty worktrees."
---

# GitHub Clear Gone

Resolve the canonical root and current MDF state before writing a readable
`.mdf/work/{work_id}/git-cleanup-NNN.md` report. If MDF initialization is
missing, stop and tell the user to run `mdf init`. The report is separate from
branch or worktree deletion.

1. Fetch with prune, inspect `git branch -v`, and list `git worktree list`.
2. Identify only local branches marked `[gone]`. Never treat a merely stale or
   untracked branch as a deletion candidate.
3. For every candidate, identify its associated worktree and run
   `git -C <worktree> status --short`. Protect the current branch, current
   repository root, default branch, active task worktree, and any branch not
   marked `[gone]`.
4. Show the complete clean/dirty candidate list before deletion. Clean gone
   branches with no associated worktree or a clean worktree may be removed as
   part of the requested cleanup. Do not silently discard any file.
5. For each dirty worktree, ask for a separate current confirmation that names
   the exact path and acknowledges uncommitted changes will be discarded. Do
   not use `--force` or remove the worktree before that confirmation.
6. Remove an associated worktree before its gone local branch. Use
   `git worktree remove --force <path>` only after the relevant clean/dirty
   status and confirmation boundary has passed, then use `git branch -d <name>`.
7. Report what was removed automatically, what was removed after confirmation,
   and what remains. If no branches are marked `[gone]`, report that no cleanup
   was needed.

This skill never merges, pushes, creates commits, deletes non-gone branches,
removes the current worktree, or mutates task cards or locks. Ambiguous Git
state, a dirty canonical checkout, a protected path, or missing confirmation
is a stop.
