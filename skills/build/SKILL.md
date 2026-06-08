---
name: build
description: "Use when the user invokes build or asks to implement the next planned task incrementally with TDD, verification, and commits."
---

# build

Use this Codex-native entrypoint when the user invokes `build`, `mdf build`, `$build`, or asks to implement the next pending task.

Invoke the `incremental-implementation` skill alongside the `test-driven-development` skill.

For review gates, load and apply the shared `code-review-and-quality` instructions. In Codex, skills are instruction documents rather than callable functions, so do not describe same-agent review as a separate invoked workflow. Use fresh-context or subagent review only when the current user explicitly authorizes subagents, delegation, or parallel agent work and the runtime exposes the needed tools.

By default, process every pending task from the current plan in dependency order. If the user explicitly asks for only the next task or a specific task, process only that requested task.

For each pending task:

1. Read the task's acceptance criteria
2. Load relevant context (existing code, patterns, types)
3. Write a failing test for behavior changes, or define the task-specific verification first when the task is documentation or workflow-instruction only
4. Implement the smallest change that satisfies the task
5. Run task-relevant tests, build checks, lint/type checks, or manual instruction review
6. Save or update a task-level `.mdf/work/{work_id}/build-NNN.md` artifact with `Task Acceptance Traceability`
7. Save a separate task-scope `.mdf/work/{work_id}/review-NNN.md` artifact using `code-review-and-quality` in `task` scope against the plan acceptance criteria
8. If the task review has blocking findings, save the blocking review artifact, fix the findings, rerun affected verification, update build evidence when needed, and save a later passing review artifact that references or clearly supersedes the blocking review
9. Commit with a descriptive message only after the task build artifact and a passing task review artifact exist
10. Mark the task complete and move to the next one

After all selected tasks complete, run a final whole-build verification:

1. Run the full test suite where available
2. Run build, typecheck, and lint commands where available
3. Save a separate final whole-build `.mdf/work/{work_id}/build-NNN.md` artifact with `Whole-Build Spec Traceability`
4. Save a separate whole-build `.mdf/work/{work_id}/review-NNN.md` artifact using `code-review-and-quality` in `whole-build` scope against the spec and plan
5. If the whole-build review has blocking findings, save the blocking review artifact, fix the findings, rerun affected verification, update build evidence when needed, and save a later passing review artifact that references or clearly supersedes the blocking review
6. If the plan contains any high-risk requirement, or build discovers a new high-risk semantic concern, run a mandatory high-risk independent review before claiming build completion

If any step fails, follow the `debugging-and-error-recovery` skill.

`build` may invoke test and review logic internally as quality gates, but `test` and `review` remain standalone workflows for independent verification, manual changes, debugging, PR preparation, and pre-ship checks. `ship` remains the final GO/NO-GO workflow.

Subagent-assisted build or review may be used only when both conditions are true:

1. The current user request explicitly authorizes subagents, delegation, or parallel agent work.
2. The runtime exposes the needed subagent tools.

When those conditions are not met, keep implementation, verification, task review, and whole-build review inline in this single `build` workflow.

Task-level build artifacts must trace each task acceptance criterion and task-assigned high-risk semantic criterion to concrete evidence. The final whole-build artifact must compare the finished implementation back to the approved spec, not only to the possibly weakened plan text.

Embedded `Task-Scope Review`, `Whole-Build Review`, or similar sections inside `build-NNN.md` may exist only as summaries or links. They do not satisfy task, whole-build, or high-risk review gates. The gate is satisfied only by a separate `review-NNN.md` artifact for the relevant scope.

The high-risk independent review gate is required whenever high-risk requirements exist or are discovered. Run it after task-level build artifacts, task-level review artifacts, the final whole-build artifact, and whole-build review artifact have completed, but before `$mdf:build` claims completion. Scope it narrowly to high-risk semantic compliance: approved spec requirement text, plan classification and implementation meaning, task build artifact RED/GREEN/code-path evidence, final whole-build traceability, actual changed code paths, required scenarios, and negative scenarios. Save the result as a separate `.mdf/work/{work_id}/review-NNN.md` artifact.

Prefer fresh-context or subagent independent review only when both conditions are true: the current user request explicitly authorizes subagents, delegation, or parallel agent work, and the runtime exposes the needed tools. If fresh-context/subagent review is unavailable or unauthorized, do not skip the gate; run an inline standalone-like independent pass through `code-review-and-quality` and record `Freshness: standalone-like inline pass` or equivalent in the review artifact.

When saving implementation notes or build evidence, verify MDF user and project init state, resolve the current MDF work item, and write `.mdf/work/{work_id}/build-NNN.md`. If init state is missing, stop and instruct the user to run `mdf init`. Update `item.md` `latest.build` and `.mdf/index.jsonl` after every saved build artifact. When saving review evidence, write `.mdf/work/{work_id}/review-NNN.md` and update `item.md` `latest.review` plus `.mdf/index.jsonl`. After a complete `$mdf:build` run, the latest build pointer should reference the final whole-build artifact and the latest review pointer should reference the last passing whole-build or high-risk review artifact, whichever is later.

Before claiming `$mdf:build` completion, verify:

- Every selected plan task has a task-level `build-NNN.md` artifact with `Task Acceptance Traceability`.
- Every selected plan task has a separate passing task-scope `review-NNN.md` artifact.
- The whole build has a final `build-NNN.md` artifact with `Whole-Build Spec Traceability`.
- The whole build has a separate passing whole-build `review-NNN.md` artifact.
- A separate high-risk `review-NNN.md` artifact exists and passes when high-risk requirements exist or are discovered.
- Every blocking review artifact is preserved, affected verification was rerun after fixes, build evidence was updated when needed, and a later passing review artifact references or clearly supersedes the blocking review.
- `item.md` and `.mdf/index.jsonl` have current `latest.build` and `latest.review` pointers.
