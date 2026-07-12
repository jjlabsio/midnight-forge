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

From the resolved plugin root, register the raw artifact and exact review via
production `./scripts/mdf-controller.js spec register`. Pass JSON on stdin with
`artifact_path`, raw `review_output_path`, provenance-bound
`review_decision_file`, and `mode`. In a technical revision, also pass the
exact returned `revision_file`. Use `spec approve` only with `affirmative:
true` after explicit user approval, then `spec advance` with the matching
registration and approval. For a controller-verified intent-preserving
technical revision, `spec advance` uses the exact revision evidence as its
automatic authorization; do not fabricate a human approval.

## Approval contract

Initial-generation planning requires explicit affirmative user approval of the
exact canonical artifact revision/hash for the spec. Follow
`../../references/approval-evidence.md`: the controller's JSON interaction and
decision sidecars are the canonical approval record, and `item.md.latest.spec`
must name the registered artifact at approval and advance time. Do not create a
duplicate `approval-NNN.md` file. Any later edit, replacement, or latest-pointer
change must invalidate prior approval; do not carry approval to a new revision.
A saved artifact or a reviewer pass is not approval.

For the initial generation, `auto-workflow` must stop here until explicit spec
approval exists. A verified intent-preserving technical revision instead calls
`spec advance` without `approval_file`; its exact revision evidence authorizes
only the newly reviewed spec generation.

When recovery returns `technical-revision`, run exact upstream spec-driven
development and review against original intent, prior spec, current recovery
evidence, and the new raw spec. Submit them to production
`./scripts/mdf-controller.js technical-revision`. Intent-preserving technical
constraints return to `spec`; a user-goal, external-behavior, scope, or
material-trade-off change stops for human judgment. Re-run fresh spec and plan
reviews/registration; the revision evidence authorizes their automatic
advances. Never reuse prior downstream evidence.
