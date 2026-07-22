---
name: auto-workflow
description: "Run MDF's local implementation workflow through review, simplification, and commit."
---

# auto-workflow

1. Resolve the installed plugin root.
2. Run exact upstream `using-agent-skills` discovery and load every applicable
   primitive.
3. Load `auto-workflow-contract.md` and select its `auto-workflow` profile.
4. In the root, validate task, lock, worktree, branch, handoff, artifacts, and
   Git state.
5. Run the profile exactly. Dispatch stage executors and critics from the root;
   do not ask stage skills to interpret the profile.
6. Keep simplification outside the slice loop: all slice commits, whole-build
   verification, and whole-build review come first.
7. Write the root handoff and finish with verified local success or `BLOCKED`.

This profile may create task-owned local commits. It does not authorize ship,
whole-task completion, push, PR mutation, merge, deploy, deletion, force,
stale-lock takeover, or cleanup. Keep the task active and lock held.
