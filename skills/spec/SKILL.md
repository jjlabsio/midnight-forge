---
name: spec
description: "Use when the user invokes spec, mdf spec, or asks to create an approved MDF specification before planning."
---

# spec

This is an MDF controller, not a replacement for the upstream workflow.
Resolve the installed plugin root from this loaded skill before reading any
skill, persona, reference, or script path. Fail rather than guessing when the
plugin root cannot be resolved.

1. Load and follow the exact upstream `../spec-driven-development/SKILL.md`.
2. For a non-trivial draft, load and follow the exact upstream
   `../doubt-driven-development/SKILL.md`; its full
   `CLAIM -> EXTRACT -> DOUBT -> RECONCILE -> STOP` process remains intact.
3. The root agent saves the resulting artifact under the resolved canonical
   MDF work item as `spec-NNN.md`. No subagent writes the artifact.
4. Run one independent upstream review of the saved artifact when the upstream
   doubt workflow requires it. A generic subagent, when used, receives the
   exact selected upstream prompt plus ARTIFACT and CONTRACT only.
5. Stop after this phase. Do not plan or build in a standalone `spec` run.

## Approval contract

Planning requires an explicit affirmative user approval of the exact canonical
artifact revision/hash. Persist and verify the
`../../references/approval-evidence.md` schema: `approval-NNN.md` must match
the current `latest.spec`, its SHA-256, and its latest-pointer value before the
controller advances. Any later edit, replacement, or latest-pointer change must
invalidate prior approval; do not carry approval to a new revision. A saved
artifact or a reviewer pass is not approval.

`auto-workflow` must also stop here until the explicit spec approval exists.
