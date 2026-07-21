---
name: plan
description: "Break work into small verifiable tasks with acceptance criteria and dependency ordering. Use when breaking an approved MDF specification into an ordered implementation plan."
---

# plan

## Auto-workflow contract boundary

When called with `mode: auto-workflow` or `mode: auto-workflow-pr`, load the
plugin-installed `../../references/auto-workflow-contract.md` and use its
current handoff and authority rules. This skill owns plan-specific artifact
creation, revision, and acceptance; it does not redefine shared auto-mode
authority or lifecycle behavior.

## Upstream command contract

Invoke the planning-and-task-breakdown skill.

Read the existing spec (`SPEC.md` or equivalent) and the relevant codebase
sections. Then:

1. Enter plan mode — read only, no code changes
2. Identify the dependency graph between components
3. Slice work vertically (one complete path per task, not horizontal layers)
4. Write tasks with acceptance criteria and verification steps
5. Add checkpoints between phases
6. Present the plan for human review

Save the plan to `tasks/plan.md` and task list to `tasks/todo.md`.

## MDF/Codex adaptation

Plans are model-led Markdown artifacts. Resolve the installed plugin root and
require the current explicit approval of the exact specification revision
before planning in standalone mode. In automatic modes, use the exact
specification and handoff supplied by the loaded auto-workflow contract. Load
and follow the exact upstream `../planning-and-task-breakdown/SKILL.md`, including its risk
matrix, early-risk handling, Definition of Done, and sign-off requirements.
For non-trivial planning decisions also apply the exact
`../doubt-driven-development/SKILL.md` process. These are MDF planning-quality
adaptations; they do not replace the upstream planning sequence.

## Create or revise a plan

1. Read the approved specification by its exact path and SHA-256, relevant
   documentation and decisions, and current task state.
2. Break the work into ordered, independently verifiable tasks. Each task must
   state its dependencies, owned paths, acceptance criteria, verification
   commands, and any human or external confirmation stop.
3. Include the whole-build verification matrix and identify generated files,
   source-of-truth inputs, and packaging checks where applicable.
4. Write a new revision under the canonical work item as
   `.mdf/work/<work-id>/plan-NNN.md`; never patch an approved revision in place.
   This is the MDF adaptation of the upstream `tasks/plan.md` and
   `tasks/todo.md` outputs; do not create unsynchronized duplicate copies.
5. Review the complete plan against the approved specification and upstream
   Definition of Done. Fix actionable findings before presenting it.
6. Compute the SHA-256 of the exact saved bytes and report the path and hash.

The root agent owns the plan artifact write. The plan is a checklist and
decision aid, not a replacement task state machine: ordinary model judgment
chooses the next ready task and explains ambiguity.

## Approval contract

Standalone initial implementation requires explicit affirmative user approval
of the exact canonical artifact revision/hash for the plan. A review pass or a
saved plan is not approval. In automatic modes, use the current handoff from
the loaded auto-workflow contract; it replaces only the repeated checkpoint
and is not semantic plan approval. Any material change must follow that
contract's revision and invalidation rules.
Record approval in a concise human-readable work-item note or the task
conversation; keep approval and planning state readable and tied to the exact
artifact. If a file is needed, use one human-readable `approval-NNN.md` note
for that exact revision and do not duplicate it.

Standalone automatic-looking workflow stops before build until both exact
approvals are current. In automatic modes, continue only under the current
auto-workflow handoff after its dependency and critical-decision checks pass.
Do not silently continue from an invalidated plan revision.

Stop after this phase in a standalone `plan` run. Do not begin implementation
as an unstated continuation.
