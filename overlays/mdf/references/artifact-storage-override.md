# MDF Artifact Storage Override

Preserve the upstream artifact content, structure, review criteria, and workflow intent. Override only the default persistence location for workflow artifacts.

When a skill would normally save tracked repository files such as `SPEC.md`, `tasks/plan.md`, `tasks/todo.md`, `docs/`, or other workflow notes, MDF stores those artifacts under the current MDF work item by default:

```text
<canonical-root>/.mdf/work/{work_id}/{artifact-type}-NNN.md
```

Resolve the canonical root from the active checkout. If the checkout is under `<canonical-root>/.worktrees/<branch>`, use `<canonical-root>` for MDF state. Verify user and project init state before reading or writing MDF state. If init state is missing, stop and instruct the user to run `mdf init`.

Only promote an artifact into tracked repository documentation when the user explicitly asks for a tracked document or the project policy requires durable reviewed docs.
