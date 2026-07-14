---
name: spec
description: "Start spec-driven development — write a structured specification before writing code. Use when defining or revising a non-trivial MDF change before planning or implementation."
---

# spec

## Upstream command contract

Invoke the spec-driven-development skill.

Begin by understanding what the user wants to build. Ask clarifying questions
about:

1. The objective and target users
2. Core features and acceptance criteria
3. Tech stack preferences and constraints
4. Known boundaries (what to always do, ask first about, and never do)

Then generate a structured spec covering all six core areas: objective,
commands, project structure, code style, testing strategy, and boundaries.

Save the spec as `SPEC.md` in the project root and confirm with the user before
proceeding in a standalone invocation. In `mode: auto-workflow`, report the
exact canonical path and SHA-256, verify the mandatory `interview-me` preflight
and absence of a critical unresolved question, then continue under the
run-scoped auto authorization without asking for a ceremonial approval.

## MDF/Codex adaptation

MDF specifications are model-led Markdown artifacts, not a replacement for
the upstream workflow. Resolve the canonical project root and installed plugin
root from the current checkout before reading or writing project state; an
unresolved plugin root is a stop. Load and follow the exact upstream
`../spec-driven-development/SKILL.md`.
When the caller carries `mode: auto-workflow`, also load
`../../references/auto-workflow-contract.md`.

For non-trivial decisions, also load the exact upstream
`../doubt-driven-development/SKILL.md` and preserve its
`CLAIM -> EXTRACT -> DOUBT -> RECONCILE -> STOP` process. This is an MDF
decision-quality adaptation and does not replace the upstream six-area spec
contract.

## Create or revise a specification

1. Inspect the relevant project documentation, current task card, existing
   decisions, and repository state before drafting.
2. Extract the user's goal, non-goals, constraints, observable behavior,
   risks, and acceptance criteria. Ask only the questions needed to resolve a
   material ambiguity.
3. Write a new Markdown revision under the canonical work item as
   `.mdf/work/<work-id>/spec-NNN.md`. Never overwrite an earlier revision.
   This is the MDF adaptation of the upstream `SPEC.md` output; do not create
   an unsynchronized second copy.
4. Review the complete artifact against the upstream definition of done and
   the applicable doubt-driven-development result. Fix actionable findings
   before presenting the artifact.
5. Compute the SHA-256 of the exact saved bytes and report the path and hash.

The root agent owns the artifact write. Reviewers may comment on the draft but
do not silently replace it. Historical specifications remain readable.

## Approval contract

Standalone initial planning requires an explicit affirmative user approval of
the exact canonical artifact revision/hash just reported. A saved artifact or
a review pass is not approval. In `mode: auto-workflow`, the run-scoped intent
authorization replaces only this repeated checkpoint; it is not semantic
approval and may be used only while the intent, scope, path, and bytes remain
unchanged. If the bytes, path, scope, or latest revision changes, invalidate
the auto handoff and create a new revision.

In a standalone automatic-looking invocation, stop after presenting the
specification until that approval is observed. In `mode: auto-workflow`, do
not write a fake `approval-NNN.md`; record the auto handoff and exact hash in
the run/work-item log. Never plan or build on an unapproved standalone or
ambiguous auto revision.

## Technical revisions and handoff

When recovery reveals an intent-preserving technical constraint, produce a new
specification revision and review it against the original intent, prior
specification, current failure evidence, and the new constraints. A change to
the user's goal, external behavior, scope, or material trade-off stops for
human judgment. Once the exact new revision is approved, hand off to `plan`.

Stop after this phase in a standalone `spec` run. Do not plan or build as an
unstated continuation.
