---
name: quick-workflow-pr
description: "Run a bounded lightweight implementation, review, commit, and GitHub PR workflow."
---

# quick-workflow-pr

Use only when the user explicitly selects the bounded small-change workflow.

1. Resolve the installed plugin root.
2. Run exact upstream `using-agent-skills` discovery and load every applicable
   primitive.
3. Load `auto-workflow-contract.md` and select its `quick-workflow-pr` profile.
4. In the root, validate task, lock, worktree, branch, bounded scope, handoff,
   Git, and current remote state.
5. Dispatch one bounded build executor, observe the actual diff and checks,
   then dispatch one fresh read-only bounded-change critic.
6. Commit only after the critic passes. Repair findings through the same
   executor/critic loop.
7. Invoke canonical `github-pr`; verify remote OID, latest-head checks,
   mergeability, and conflicts.
8. Keep the task `active` and lock held. Return the merged-delivery handoff and
   stop for the user to merge the PR, then use `github-after-merge` once it is
   merged.
9. Finish with a verified PR handoff or `BLOCKED`; task completion is a
   post-merge operation.

This profile omits spec, plan, simplification, ship, separate whole-build
verification, and separate whole-tree review. It creates no empty gates. Merge,
deploy, deletion, force, stale-lock takeover, and cleanup are prohibited.
