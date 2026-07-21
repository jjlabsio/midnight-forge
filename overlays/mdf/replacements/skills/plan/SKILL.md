---
name: plan
description: "Break work into small verifiable tasks with acceptance criteria and dependency ordering"
---

# plan

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

Plans are model-led Markdown artifacts. Resolve the canonical project root and
installed plugin root from the current checkout; stop if either is unresolved.
Load and run the exact upstream `../using-agent-skills/SKILL.md` discovery
workflow, resolve this canonical adapter, then load the exact upstream
`../planning-and-task-breakdown/SKILL.md` and every other applicable primitive
selected by discovery.

When the caller supplies normalized automatic stage context, also load
`../../references/auto-workflow-contract.md` and require `Stage` to select this
canonical `plan` adapter and one plan revision. Apply the context's acceptance
baseline, continuity, lease, output disposition, capabilities, and mandatory
`Planning` Two-Key gate. The context's mode is provenance only; a raw mode or
handoff without normalized context is malformed and finishes `BLOCKED`. This
skill owns only the canonical planning artifact and plan-specific evidence; it
does not select or advance lifecycle. In a standalone invocation, require
current explicit approval of the exact specification revision before planning.

For non-trivial planning decisions, also load the exact upstream
`../doubt-driven-development/SKILL.md` and preserve its
`CLAIM -> EXTRACT -> DOUBT -> RECONCILE -> STOP` process. These are MDF
planning-quality adaptations; they do not replace the upstream dependency,
vertical-slice, risk, checkpoint, Definition of Done, or sign-off sequence.

Load the shared `../../references/approval-evidence.md` before applying this
skill's approval gates. It owns the common exact-artifact path/hash,
affirmative approval, recording, and invalidation rules.

## Create or revise a plan

1. Read the approved specification by its exact path and SHA-256, relevant
   documentation and decisions, and current task state.
2. Map the dependency graph, then break the work into small vertical slices
   ordered by dependency and early risk. Each task must leave the system
   working and state its dependencies, owned paths, estimated scope,
   acceptance criteria, verification commands, and any human or external
   confirmation stop.
3. Add checkpoints between phases or every two to three tasks. Include the
   risk-and-mitigation matrix, whole-build verification matrix, project-wide
   Definition of Done, and generated files, source-of-truth inputs, and
   packaging checks where applicable.
4. Write a checklist-style new revision under the canonical work item as
   `.mdf/work/<work-id>/plan-NNN.md`; never patch an approved revision in place.
   This is the MDF adaptation of the upstream `tasks/plan.md` and
   `tasks/todo.md` outputs; do not create unsynchronized duplicate copies.
5. Review the complete plan against the approved specification and upstream
   planning verification and Definition of Done. Fix actionable findings
   before presenting it for the applicable sign-off.
6. Compute the SHA-256 of the exact saved bytes and report the path and hash.

In a standalone invocation, the root owns the plan artifact write. Under
normalized stage context, use the bounded writer below. The plan is a checklist
and decision aid, not a replacement task state machine: the root entrypoint,
not this adapter, chooses the next ready task and explains ambiguity.

## Automatic-stage producer and verification

When normalized `Planning` stage context is present, apply the shared Two-Key
lease without duplicating it:

1. The root supplies the exact approved specification bytes, path, and hash,
   and assigns one unused canonical `plan-NNN.md` path. One bounded producer is
   the sole writer and may write only that new revision while running exact
   discovery and the canonical planning primitives above.
2. The producer cannot mutate task cards, locks, handoffs, indexes,
   observations, any other canonical MDF state, source code, commits,
   lifecycle, remote or external state; accept the plan; or perform final
   synthesis.
3. After positive producer terminality, the root observes the actual plan
   bytes and hash plus the complete canonical and Git evidence required by the
   shared contract. A producer report or self-authored hash is not evidence.
4. A distinct fresh-context, read-only, non-delegating verifier assesses those
   actual bytes against the exact approved specification, original planning
   contract, acceptance criteria, upstream planning verification and
   Definition of Done, and root-observed evidence without producer reasoning.
   The root alone reconciles `PASS`, `REWORK`, or `BLOCKED` and accepts a
   passing revision.

The automatic verifier supplies the fresh adversarial `DOUBT` step for the
plan artifact; preserve the complete upstream
`CLAIM -> EXTRACT -> DOUBT -> RECONCILE -> STOP` process without nested
delegation. Missing keys, stale or changed state, scope violations, exhausted
cycles, or uncertain writer terminality stop under the shared contract.

## Approval contract

Apply the shared `../../references/approval-evidence.md` contract. Standalone
initial implementation requires explicit affirmative user approval of the
exact canonical plan revision/hash; planning also requires the exact approved
specification revision before it begins. A review pass or a saved plan is not
approval. Under normalized automatic stage context, use the current handoff
from the loaded auto-workflow contract only after a Two-Key `PASS`; it replaces
the repeated human checkpoint and is not semantic plan approval. Any byte,
path, scope, or task-order change requires a new revision and causes the root
to invalidate the handoff and affected downstream evidence. Record standalone
approval according to the shared reference and keep it tied to the exact
artifact.

Standalone automatic-looking workflow stops before build until both exact
approvals are current. Under normalized automatic stage context, return only a
verified plan result to the root after its dependency and critical-decision
checks pass. Do not silently continue from an invalidated plan revision or
begin build from this adapter.

## Revisions and handoff

A plan-only revision is valid only for a dependency, order, owned-path, or task
scope representation defect while the approved specification and its material
constraints remain valid. A change to acceptance meaning, user goal, scope,
public behavior, security/privacy/data/permission constraints, material
architecture or operations, compatibility, or a required user decision needs
a new specification revision first.

For automatic recovery, normalized stage context must contain the root's
intent-preserving classification before dispatch; the producer cannot write
that handoff. A new accepted plan revision invalidates affected slice,
verification, and review evidence. Reconcile completed commits and any
provisional diff against it rather than redoing work or committing
automatically. Return the verified plan to the root only after Two-Key `PASS`
and all dependency, checkpoint, and critical-decision stops are clear; the root
alone selects any build continuation.

Stop after this phase in a standalone `plan` run. Do not begin implementation
as an unstated continuation.
