---
name: auto-workflow-pr
description: "Run MDF's complete implementation, assessment, commit, and GitHub PR workflow."
---

# auto-workflow-pr

1. Resolve the installed plugin root.
2. Run exact upstream `using-agent-skills` discovery and load every applicable
   primitive.
3. Load `auto-workflow-contract.md` and select its `auto-workflow-pr` profile.
4. Validate root-owned local and remote state; run or resume the selected
   profile without repeating accepted work.
5. Write its required delivery handoff; finish with verified PR handoff or
   `BLOCKED`.

Apply only the profile's authority. Stage skills do not interpret the profile.
