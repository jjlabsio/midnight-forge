# Scoped autonomous auto-workflow orchestration

## Status

Accepted

## Date

2026-07-14

## Context

The standalone MDF skills intentionally retain semantic approvals and
high-risk stops. Requiring those checkpoints unchanged inside
`auto-workflow`, however, turns a requested one-run orchestration into a
sequence of ceremonial prompts. The same problem appeared in spec, plan,
review, and ship because no run-scoped handoff contract distinguished a
settled intent from a new critical decision.

The workflow also needs to save root context with bounded subagents, prefer
Spark for narrow codebase exploration when its transport is actually usable,
and permit parallel writers only when independence can be defended.

## Decision

Add an MDF-only readable contract with separate local `auto-workflow` and
delivery `auto-workflow-pr` modes. Task creation/activation remains independent
from either workflow; the profile reads the task as intent and lifecycle
evidence rather than a workflow-readiness or action grant. A direct profile
invocation grants its documented ordinary scope, while a bare internal mode
string without current run context grants nothing. The current handoff,
task/lock/worktree/branch facts, and accepted artifact hashes remain required.

The profile owns intent sufficiency. It invokes `interview-me` before spec only
for materially different user outcomes, unresolved user-owned trade-offs, or
missing intent that cannot be settled by specification. It invokes
`idea-refine` only for requested ideation, stress-testing, or product direction,
not delegated technical alternatives. A clear or explicitly delegated request
continues without an interview.

Once intent is settled, local `auto-workflow` may run the in-scope
spec/plan/build/test/review/simplify loop and commit each plan slice while
leaving the whole MDF task active. `auto-workflow-pr` may resume those slices,
use the latest spec as its acceptance baseline, run ship, and—only after final
preflight—push and create/update the PR. It leaves the task active with its
lock held and returns a merged-delivery handoff. That return ends the delivery
profile. A later explicit, separate `github-after-merge` invocation completes
the task only after the accepted PR revision is merged. Both modes
must still stop for critical product/public-contract/security/privacy/data/
permission/cost/destructive/irreversible decisions, failed verification,
repeated no-progress, lock conflicts, changed artifact hashes, uncertain PR
state, or scope expansion. Merge, deploy, deletion, stale-lock takeover, and
unrelated cleanup are never implied.

Subagents are bounded and report-only by default. The later
[root-owned workflow driver decision](root-owned-workflow-drivers.md) permits a
root-dispatched executor to receive one bounded artifact or source write scope,
followed by root observation and a fresh read-only critic. Stage adapters do
not interpret automatic modes. Canonical task state, commits, external actions,
artifact acceptance, sequencing, and synthesis remain root-owned. Spark
remains limited to narrow read-only exploration. Shared-worktree writers remain
serial; unknown ownership or completion ends blocked.

## Consequences

- Standalone upstream and MDF skill behavior remains unchanged.
- Task capture and lifecycle remain independent of automatic workflow routing.
- Automatic actor and checkpoint semantics are governed by the later
  root-owned workflow driver decision.
- Auto-workflow can complete routine work without repeated approval prompts.
- The automatic grant is explicit and bounded, so it does not turn ambiguity
  into consent or silently authorize high-impact actions.
- The readable policy is flexible and model-led; intent meaning, review
  quality, and ship readiness remain model judgments.
- Defensive serial fallback may be slower, but it avoids parallel write races
  when independence cannot be proven.
- Generated runtime files remain derived from overlays and inventory; the
  pinned upstream vendor tree is not modified.
