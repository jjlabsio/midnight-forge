---
name: auto-workflow
description: "Run MDF's local implementation workflow through review, simplification, and commit."
---

# auto-workflow

1. Resolve the installed plugin root.
2. Run exact upstream `using-agent-skills` discovery and load every applicable
   primitive.
3. Load `auto-workflow-contract.md` and select its `auto-workflow` profile.
4. Validate root-owned state and run the selected profile exactly.
5. Write its required handoff; finish with verified local success or `BLOCKED`.

Apply only the profile's authority. Stage skills do not interpret the profile.
