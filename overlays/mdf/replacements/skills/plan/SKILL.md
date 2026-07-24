---
name: plan
description: "Break work into small verifiable tasks with acceptance criteria and dependency ordering"
---

# plan

## Upstream command contract

Invoke the planning-and-task-breakdown skill.

Read the existing spec (SPEC.md or equivalent) and the relevant codebase sections. Then:

1. Enter plan mode — read only, no code changes
2. Identify the dependency graph between components
3. Slice work vertically (one complete path per task, not horizontal layers)
4. Write tasks with acceptance criteria and verification steps
5. Add checkpoints between phases
6. Present the plan for human review

## MDF adaptation

### Persistence port

Replace the upstream final `tasks/plan.md` and `tasks/todo.md` persistence
instruction with one checklist-style immutable
`.mdf/work/<work-id>/plan-NNN.md`. Preserve both upstream plan and task-list
roles; do not create divergent `tasks/` copies.

1. Resolve the installed plugin and canonical project roots.
2. Run exact upstream `using-agent-skills` discovery. Load this adapter,
   `planning-and-task-breakdown`, and every other applicable primitive it
   selects.
3. Require the exact approved specification revision and read current project
   guidance, decisions, task state, and relevant code.
4. Include dependencies, owned paths, acceptance criteria, verification,
   checkpoints, and the whole-build verification matrix.
5. Apply `<plugin-root>/references/approval-evidence.md` to the exact artifact
   path and SHA-256.
6. Stop after the plan. Build is a separate invocation.

When delegated, report operation, status, inputs, output path and hash,
findings, assumptions, and blockers. Do not select the next operation, accept
the artifact, advance lifecycle, or grant authority.
