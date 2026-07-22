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
delivery `auto-workflow-pr` modes. The contract is active only when the caller
supplies the exact mode and a current run context. A bare mode string grants no
authority; the current handoff, task/lock/worktree/branch facts, and approved
artifact hashes are required. It requires
`interview-me` before spec when intent is materially unclear, including missing
intent fields, materially different interpretations, unsurfaced assumptions,
conflicting goals, confidence below 95%, or an explicit interview request.
Clear mechanical requests do not need an interview.

Once intent is settled, local `auto-workflow` may run the in-scope
spec/plan/build/test/review/simplify loop and commit each plan slice while
leaving the whole MDF task active. `auto-workflow-pr` may resume those slices,
use the latest spec as its acceptance baseline, run ship, and—only after final
preflight—push and create/update the PR. The root completes the task only after
latest-head checks, mergeability, and conflict gates pass. Both modes
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
