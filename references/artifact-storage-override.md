# MDF Artifact Storage Override

Preserve the upstream artifact content, structure, review criteria, and workflow intent. Replace upstream persistence instructions for workflow artifacts with this MDF storage rule.

When a skill would normally save workflow notes, plans, reports, contracts, or other generated artifacts, MDF stores those artifacts under the current MDF work item:

```text
<canonical-root>/.mdf/work/{work_id}/{artifact-type}-NNN.md
```

Resolve the canonical root from the active checkout. If the checkout is under `<canonical-root>/.worktrees/<branch>`, use `<canonical-root>` for MDF state. Verify user and project init state before reading or writing MDF state. If init state is missing, stop and instruct the user to run `mdf init`.

Do not preserve upstream tracked-file storage instructions inside artifact-storage overlays. If a future workflow needs tracked repository documentation, model that as a separate explicit overlay or MDF-native workflow rule instead of leaving the upstream storage path in place.
