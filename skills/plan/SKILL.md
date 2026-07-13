---
name: plan
description: "Use when breaking an approved MDF specification into an ordered implementation plan."
---

# plan

Plans are model-led Markdown artifacts. Resolve the installed plugin root and
require the current explicit approval of the exact specification revision
before planning. An unresolved plugin root is a stop. Load and follow the exact
upstream `../planning-and-task-breakdown/SKILL.md`, including its risk matrix,
early-risk handling, Definition of Done, and sign-off requirements. For
non-trivial planning decisions also apply the exact
`../doubt-driven-development/SKILL.md` process.

## Create or revise a plan

1. Read the approved specification by its exact path and SHA-256, relevant
   documentation and decisions, and the current task state.
2. Break the work into ordered, independently verifiable tasks. Each task must
   state its dependencies, owned paths, acceptance criteria, verification
   commands, and any human or external confirmation stop.
3. Include the whole-build verification matrix and identify generated files,
   source-of-truth inputs, and packaging checks where applicable.
4. Write a new revision under the canonical work item as
   `.mdf/work/<work-id>/plan-NNN.md`; never patch an approved revision in place.
5. Review the complete plan against the approved specification and upstream
   Definition of Done. Fix actionable findings before presenting it.
6. Compute the SHA-256 of the exact saved bytes and report the path and hash.

The root agent owns the plan artifact write. The plan is a checklist and
decision aid, not a replacement task state machine: ordinary model judgment
chooses the next ready task and explains ambiguity.

## Approval contract

Initial implementation requires explicit affirmative user approval of the exact
canonical artifact revision/hash for the plan. A review pass or a saved plan is
not approval. Any byte, path, scope, or task-order change requires a new
revision and new approval; invalidate prior approval when that happens. Record
approval in a concise human-readable work-item note or the task conversation;
keep approval and planning state readable and tied to the exact artifact. If a
file is needed, use one human-readable `approval-NNN.md` note for that exact
revision and do not duplicate it.

Automatic workflow stops before build until both the exact specification and
the exact plan approvals are current. A technical revision does not silently
authorize an old plan; regenerate and review the affected plan revision.

Stop after this phase in a standalone `plan` run. Do not begin implementation
as an unstated continuation.
