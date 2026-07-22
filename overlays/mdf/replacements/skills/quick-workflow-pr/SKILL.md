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
4. Validate root-owned local and remote state; run the selected profile exactly.
5. Write its required delivery handoff; finish with verified PR handoff or
   `BLOCKED`.

Apply only the profile's authority. Stage skills do not interpret the profile.
