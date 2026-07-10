---
name: plan
description: "Use when the user invokes plan, mdf plan, or asks to create an approved MDF implementation plan."
---

# plan

This is an MDF controller. Resolve the installed plugin root from this loaded
skill before loading paths; unresolved plugin-root references are a validation
failure, not an invitation to invent a path.

1. Require current, explicit approval of the selected spec revision.
2. Load and follow the exact upstream
   `../planning-and-task-breakdown/SKILL.md`, including its ordinary risk
   matrix, early-risk handling, Definition of Done, and sign-off requirements.
   Do not add MDF semantic normal/high-risk classification or evaluator rules.
3. Apply the exact upstream `../doubt-driven-development/SKILL.md` process for
   non-trivial planning decisions. The root agent owns synthesis and artifact
   writes; a generic subagent may receive only the exact selected upstream
   prompt and the bounded review inputs.
4. Save the plan as canonical `plan-NNN.md`, with its ordered task list and
   acceptance criteria, then stop after this phase in standalone mode.

## Approval contract

Build requires explicit affirmative user approval of the exact canonical
artifact revision/hash. Persist and verify the
`../../references/approval-evidence.md` schema: `approval-NNN.md` must match
the current `latest.plan`, its SHA-256, and its latest-pointer value before the
controller advances. A revision or latest-pointer change must invalidate prior
approval. `auto-workflow` requires this explicit plan approval and may not treat
its own invocation as approval.
