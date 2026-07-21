---
name: spec
description: "Create or revise a structured MDF specification for a non-trivial change before planning or implementation."
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
proceeding in a standalone invocation. In `mode: auto-workflow` or
`mode: auto-workflow-pr`, report the
exact canonical path and SHA-256, verify the mandatory `interview-me` preflight
and absence of a critical unresolved question, then continue under the
run-scoped auto authorization without asking for a ceremonial approval.

## MDF/Codex adaptation

MDF specifications are model-led Markdown artifacts, not a replacement for
the upstream workflow. Resolve the canonical project root and installed plugin
root from the current checkout before reading or writing project state; stop
if either is unresolved. Load and run the exact upstream
`../using-agent-skills/SKILL.md` discovery workflow, resolve this canonical
adapter, then load the exact upstream `../spec-driven-development/SKILL.md`
and every other applicable primitive selected by discovery.

When the caller carries `mode: auto-workflow` or `mode: auto-workflow-pr`,
also load `../../references/auto-workflow-contract.md` and apply its mandatory
`Specification` Two-Key stage lease. A bare mode string is not authority.

For non-trivial decisions, also load the exact upstream
`../doubt-driven-development/SKILL.md` and preserve its
`CLAIM -> EXTRACT -> DOUBT -> RECONCILE -> STOP` process. This is an MDF
decision-quality adaptation and does not replace the upstream six-area spec
contract.

Load the shared `../../references/approval-evidence.md` before applying this
skill's approval gate. It owns the common exact-artifact path/hash, affirmative
approval, recording, and invalidation rules.

## Create or revise a specification

1. Inspect the relevant project documentation, current task card, existing
   decisions, and repository state before drafting.
2. Extract the user's goal, non-goals, constraints, observable behavior,
   risks, and acceptance criteria. In standalone mode, ask only the questions
   needed to resolve a material ambiguity. In automatic mode, require the
   completed `interview-me` preflight and stop on any unresolved material
   question.
3. Write a new Markdown revision under the canonical work item as
   `.mdf/work/<work-id>/spec-NNN.md`. Never overwrite an earlier revision.
   This is the MDF adaptation of the upstream `SPEC.md` output; do not create
   an unsynchronized second copy.
4. Review the complete artifact against the upstream definition of done and
   the applicable doubt-driven-development result. Fix actionable findings
   before presenting the artifact.
5. Compute the SHA-256 of the exact saved bytes and report the path and hash.

In standalone mode, the root owns the artifact write. In automatic mode, use
the bounded writer below. Historical specifications remain readable.

## Automatic-mode producer and verification

For `mode: auto-workflow` and `mode: auto-workflow-pr`, apply the shared
Two-Key lease without duplicating it:

1. The root assigns one unused canonical `spec-NNN.md` path. One bounded
   producer is the sole writer and may write only that new revision while
   running exact discovery and the canonical spec primitives above.
2. The producer cannot mutate task cards, locks, handoffs, indexes,
   observations, any other canonical MDF state, commits, lifecycle, remote or
   external state; accept the artifact; or perform final synthesis.
3. After positive producer terminality, the root observes the actual saved
   bytes and hash plus the complete canonical and Git evidence required by the
   shared contract. A producer report or self-authored hash is not evidence.
4. A distinct fresh-context, read-only, non-delegating verifier assesses those
   actual bytes against the original contract, all six spec areas, acceptance
   criteria, and root-observed evidence without producer reasoning. The root
   alone reconciles `PASS`, `REWORK`, or `BLOCKED` and accepts a passing
   revision.

The automatic verifier supplies the fresh adversarial `DOUBT` step for the
spec artifact; preserve the complete upstream
`CLAIM -> EXTRACT -> DOUBT -> RECONCILE -> STOP` process without nested
delegation. Missing keys, stale or changed state, scope violations, exhausted
cycles, or uncertain writer terminality stop under the shared contract.

## Approval contract

Apply the shared `../../references/approval-evidence.md` contract. For this
skill, standalone initial planning stops until the exact canonical
specification revision has received the required approval. In
`mode: auto-workflow` or `mode: auto-workflow-pr`, only a Two-Key `PASS` lets
the root use run-scoped intent authorization in place of this repeated human
checkpoint. It is not semantic approval and applies only while intent, scope,
path, and bytes remain unchanged. If any changes, invalidate the auto handoff
and create a new revision.

In a standalone automatic-looking invocation, stop after presenting the
specification until that approval is observed. In `mode: auto-workflow` or
`mode: auto-workflow-pr`, do not write a fake `approval-NNN.md`; the root
records the accepted path and exact hash in the auto handoff. Never plan or
build on an unapproved standalone or unverified automatic revision.

## Technical revisions and handoff

When recovery reveals an intent-preserving technical constraint, produce a new
specification revision and review it against the original intent, prior
specification, current failure evidence, and the new constraints. A change to
the user's goal, external behavior, scope, or material trade-off stops for
human judgment. In automatic mode, the root must record the shared contract's
intent-preserving classification before dispatch; the producer cannot write
that handoff. Once the exact new revision is approved in standalone mode or
accepted after automatic Two-Key `PASS`, hand off to `plan`.

Stop after this phase in a standalone `spec` run. Do not plan or build as an
unstated continuation.
