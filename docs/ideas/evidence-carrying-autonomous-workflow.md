# Evidence-Carrying Autonomous Workflow

## Problem Statement

How might MDF let every automatic workflow run without intermediate user input
while reducing root-context consumption and preserving quality throughout long
jobs?

Today the root often carries both orchestration and stage execution. That mixes
intent, authority, implementation detail, and verification in one growing
context. Simple delegation is not enough: a worker can return incomplete work,
share the root's blind spots, or leave a partially changed worktree.

## Confirmed Direction

Run every applicable automatic-workflow stage as an evidence-carrying stage
lease with a mandatory Two-Key gate:

1. A bounded producer executes the exact canonical stage skill and writes only
   its approved artifact or source paths.
2. A separate fresh-context, read-only verifier evaluates the same canonical
   target from actual artifact, Git, and verification state rather than the
   producer's reasoning.
3. The root independently observes the returned state, reconciles verifier
   findings, and selects only `PASS`, `REWORK`, or `BLOCKED`.

The topology is invariant. The root may select more efficient or more capable
models according to difficulty, risk, ambiguity, novelty, consequence, and
required quality, but it never removes either key, disguises root self-review
as independent verification, or lowers the quality floor for high-impact work.

The root remains the control plane. It owns user intent and run-scoped
authority, stage selection, task and lock lifecycle, artifact acceptance,
commits, external actions, and final synthesis. It does not normally repeat the
producer's implementation or import complete worker transcripts into its
context.

## Lease and Recovery

The producer receives the exact canonical skill, approved input artifact and
hash, Git base and worktree state, bounded write scope, acceptance criteria,
required verification, authority, and stop conditions. The verifier receives
the original stage contract and the root-observed canonical target, not the
producer's reasoning. It cannot write or delegate.

A failed or interrupted writer may leave partial changes. No later writer or
stage starts until the prior invocation is positively terminal and the root has
classified the actual canonical state, tree, index, HEAD, artifacts, owned
paths, and verification evidence. Failure, timeout, interruption, missing
evidence, changed bases, ambiguous ownership, or unavailable independent
verification cannot advance.

Read-only stages use two independent assessors of the same target; they do not
review each other's reports. Rework uses a fresh bounded producer and verifier.
Every failed, inconclusive, or substantive attempt counts toward a maximum of
three cycles, after which the stage ends `BLOCKED`.

## Unattended Semantics

Automatic modes do not ask intermediate questions. Routine decisions stay
inside initial run-scoped authority and canonical artifacts. Material
ambiguity, scope expansion, safety or data risk, unavailable quality
capability, or incomplete evidence ends with a final blocked report.

Standalone upstream skills retain their interaction model. MDF automatic modes
explicitly port intermediate user checkpoints to mandatory Two-Key gates and
root-only stage writing to one bounded producer lease. This is a scoped MDF
port, not a claim of upstream orchestration identity.

## Verification Boundary

The initial implementation uses existing static, source-provenance,
generated-surface, port, and focused contract assertions. It does not add a
Codex behavioral harness, fixture repository, headless trace grader, model
benchmark, or token-reduction gate. Passing validation proves what the authored
and packaged contracts require; it does not prove runtime model behavior,
quality improvement, or measured context reduction.

## Not Doing

- A generic workflow runtime, controller, state service, heartbeat, or retry daemon.
- An opaque completion protocol or fixed stage-to-model table.
- Worker-to-worker delegation, nested persona trees, or concurrent shared-worktree writers.
- Root self-review represented as an independent key.
- Changes to pinned vendor content or standalone upstream behavior.
- Automatic merge, deploy, delete, force, stale-lock takeover, or new E2E infrastructure.
