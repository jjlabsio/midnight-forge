---
name: github-after-merge
description: "Finalize a merged GitHub PR, complete its MDF task, and clean up gone branches."
---

# github-after-merge

Verify the stored `latest.pr` link, merged default-base revision, final head,
and required passing checks before mutating task state. Resolve the task's
`item.md` and `task.json` through the task-store helper. For an active task,
atomically replace its expected `active` state with `done`, retaining branch,
worktree, intent, and artifacts. A done task is a verified no-op. Stop for an
unmerged PR, invalid link, failed checks, malformed state, ambiguous linkage,
or changed status. There is no index, lock, repair, recovery, or lock-release
phase. After successful finalization, load `github-clear-gone` for its normal
cleanup contract; failed cleanup does not reopen the task.
