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
8. Save a task-level `.mdf/work/{work_id}/build-NNN.md` artifact with `Task Acceptance Traceability`
9. Commit with a descriptive message
10. Mark the task complete and move to the next one

After all selected tasks complete, run a final whole-build verification:

1. Run the full test suite where available
2. Run build, typecheck, and lint commands where available
3. Invoke the shared `code-review-and-quality` workflow in `whole-build` scope against the spec and plan
4. Fix blocking findings, then rerun the affected verification and `whole-build` scope review
5. Save a separate final whole-build `.mdf/work/{work_id}/build-NNN.md` artifact with `Whole-Build Spec Traceability`
6. If the plan contains any high-risk requirement, or build discovers a new high-risk semantic concern, run a mandatory high-risk independent review before claiming build completion

If any step fails, follow the `debugging-and-error-recovery` skill.

`build` may invoke test and review logic internally as quality gates, but `test` and `review` remain standalone workflows for independent verification, manual changes, debugging, PR preparation, and pre-ship checks. `ship` remains the final GO/NO-GO workflow.

Subagent-assisted build or review may be used only when both conditions are true:

1. The current user request explicitly authorizes subagents, delegation, or parallel agent work.
2. The runtime exposes the needed subagent tools.

When those conditions are not met, keep implementation, verification, task review, and whole-build review inline in this single `build` workflow.

Task-level build artifacts must trace each task acceptance criterion and task-assigned high-risk semantic criterion to concrete evidence. The final whole-build artifact must compare the finished implementation back to the approved spec, not only to the possibly weakened plan text.

The high-risk independent review gate is required whenever high-risk requirements exist or are discovered. Run it after task-level artifacts, the final whole-build artifact, and whole-build internal review have completed, but before `$mdf:build` claims completion. Scope it narrowly to high-risk semantic compliance: approved spec requirement text, plan classification and implementation meaning, task build artifact RED/GREEN/code-path evidence, final whole-build traceability, actual changed code paths, required scenarios, and negative scenarios. Save the result as a separate `.mdf/work/{work_id}/review-NNN.md` artifact.

Prefer fresh-context or subagent independent review only when both conditions are true: the current user request explicitly authorizes subagents, delegation, or parallel agent work, and the runtime exposes the needed tools. If fresh-context/subagent review is unavailable or unauthorized, do not skip the gate; run an inline standalone-like independent pass through `code-review-and-quality` and record `Freshness: standalone-like inline pass` or equivalent in the review artifact.

When saving implementation notes or build evidence, resolve the current MDF work item and write `.mdf/work/{work_id}/build-NNN.md`. Update `item.md` `latest.build` and `.mdf/index.jsonl` after every saved build artifact. After a complete `$mdf:build` run, the latest build pointer should reference the final whole-build artifact.
