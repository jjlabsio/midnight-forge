---
name: build
description: "Use when the user invokes build or asks to implement the next planned task incrementally with TDD, verification, and commits."
---

# build

Use this Codex-native entrypoint when the user invokes `build`, `mdf build`, `$build`, or asks to implement the next pending task.

Invoke the `incremental-implementation` skill alongside the `test-driven-development` skill.

By default, process every pending task from the current plan in dependency order. If the user explicitly asks for only the next task or a specific task, process only that requested task.

For each pending task:

1. Read the task's acceptance criteria
2. Load relevant context (existing code, patterns, types)
3. Write a failing test for behavior changes, or define the task-specific verification first when the task is documentation or workflow-instruction only
4. Implement the smallest change that satisfies the task
5. Run task-relevant tests, build checks, lint/type checks, or manual instruction review
6. Invoke the shared `code-review-and-quality` workflow in `task` scope against the plan acceptance criteria
7. Fix blocking findings, then rerun the relevant verification and `task` scope review
8. Commit with a descriptive message
9. Mark the task complete and move to the next one

After all selected tasks complete, run a final whole-build verification:

1. Run the full test suite where available
2. Run build, typecheck, and lint commands where available
3. Invoke the shared `code-review-and-quality` workflow in `whole-build` scope against the spec and plan
4. Fix blocking findings, then rerun the affected verification and `whole-build` scope review
5. Save build evidence to the MDF work item

If any step fails, follow the `debugging-and-error-recovery` skill.

`build` may invoke test and review logic internally as quality gates, but `test` and `review` remain standalone workflows for independent verification, manual changes, debugging, PR preparation, and pre-ship checks. `ship` remains the final GO/NO-GO workflow.

Subagent-assisted build or review may be used only when both conditions are true:

1. The current user request explicitly authorizes subagents, delegation, or parallel agent work.
2. The runtime exposes the needed subagent tools.

When those conditions are not met, keep implementation, verification, task review, and whole-build review inline in this single `build` workflow.

When saving implementation notes or build evidence, resolve the current MDF work item and write `.mdf/work/{work_id}/build-NNN.md`. Update `item.md` `latest.build` and `.mdf/index.jsonl`.
