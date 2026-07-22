---
name: auto-workflow-pr
description: "Run MDF's complete implementation, assessment, commit, and GitHub PR workflow."
---

# auto-workflow-pr

1. Resolve the installed plugin root.
2. Run exact upstream `using-agent-skills` discovery and load every applicable
   primitive.
3. Load `auto-workflow-contract.md` and select its `auto-workflow-pr` profile.
4. In the root, validate task, lock, worktree, branch, handoff, artifacts, Git,
   and current remote state.
5. Run or resume the local profile. Do not repeat accepted current work.
6. Invoke canonical `ship` directly from the root. Preserve its upstream
   parallel specialist fan-out and root merge; add no outer worker or critic.
7. After GO and fresh preflight, invoke canonical `github-pr`; verify remote
   OID, latest-head checks, mergeability, and conflicts.
8. Complete the task and release its lock only after every consumer gate passes.
9. Finish with verified delivery success or `BLOCKED`.

Commits, lifecycle, push, PR mutation, and external-state checks are root-only.
Merge, deploy, deletion, force, stale-lock takeover, and cleanup are prohibited.
