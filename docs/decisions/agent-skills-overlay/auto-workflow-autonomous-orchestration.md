# Scoped autonomous auto-workflow orchestration

## Status

Accepted

## Date

2026-07-14

## Context

MDF workflows need autonomous execution for delegated high-risk work. Requiring
human approval checkpoints in task creation, spec, plan, and delivery turns a
requested run into a sequence of ceremonial prompts. The authority model must
still distinguish settled intent from a new critical decision and must retain
independent AI verification, exact target/integrity checks, and fail-safe
stops.

The workflow also needs to save root context with bounded subagents, prefer
Spark for narrow codebase exploration when its transport is actually usable,
and permit parallel writers only when independence can be defended.

## Decision

Add an MDF-only readable contract with separate local `auto-workflow` and
delivery `auto-workflow-pr` modes, and apply the same autonomous authority
policy to standalone MDF task/spec/plan/build/ship workflows. The contract is
active only when the caller supplies the exact mode and a current run context.
A bare mode string grants no authority; the current handoff,
task/lock/worktree/branch facts, and exact artifact integrity hashes are
required. It requires
`interview-me` before spec when intent is materially unclear, including missing
intent fields, materially different interpretations, unsurfaced assumptions,
conflicting goals, confidence below 95%, or an explicit interview request.
Clear mechanical requests do not need an interview.

Once intent is settled, local `auto-workflow` may run the in-scope
spec/plan/build/test/review/simplify loop and commit each plan slice while
leaving the whole MDF task active. `auto-workflow-pr` may resume those slices,
use the latest spec as its acceptance baseline, run ship, and—only after final
preflight—complete the whole task, push, and create/update the PR. Both modes
must still stop for critical product/public-contract/security/privacy/data/
permission/cost/destructive/irreversible decisions outside the current
envelope, failed verification, repeated no-progress, lock conflicts, changed
artifact hashes, uncertain PR state, or scope expansion. These are `BLOCKED`
stops and do not request human approval. Merge, deploy, deletion, stale-lock
takeover, and unrelated cleanup are never implied.

Subagents are bounded and report-only by default outside automatic stage
execution. The later
[evidence-carrying automatic-stages decision](evidence-carrying-auto-stages.md)
supersedes that writer restriction only for `auto-workflow`,
`auto-workflow-pr`, and `quick-workflow-pr`: one stage producer may receive a
bounded artifact/source write lease and must be followed by a distinct
fresh-context read-only verifier. Canonical task state, commits, external
actions, artifact acceptance, and synthesis remain root-owned. Spark remains
limited to narrow read-only exploration. Shared-worktree writers remain serial;
unknown ownership or terminality ends blocked.

## Consequences

- The pinned upstream behavior remains unchanged; MDF standalone and automatic
  adapters use the same autonomous authority policy.
- Automatic stage actor and checkpoint semantics are governed by the later
  evidence-carrying automatic-stages decision.
- All in-envelope work can proceed without repeated human approval prompts.
- The autonomous grant is explicit and bounded, so it does not turn ambiguity
  into consent or silently authorize high-impact actions; unresolved or
  unverifiable risk remains `BLOCKED`.
- The readable policy is flexible and model-led; intent meaning, review
  quality, and ship readiness remain model judgments.
- Defensive serial fallback may be slower, but it avoids parallel write races
  when independence cannot be proven.
- Generated runtime files remain derived from overlays and inventory; the
  pinned upstream vendor tree is not modified.

## MDF port decision

The pinned upstream files remain immutable and continue to define the quality,
verification, review, rollback, and stop contracts. In MDF adapters only, an
upstream checklist item that names human review or approval is realized as
current autonomous authority evidence plus the applicable Two-Key `PASS` and
freshness checks. It no longer creates a human permission checkpoint. This is
a Codex/MDF authority adaptation, not a change to upstream source semantics;
any unresolved or unverifiable condition still ends `BLOCKED`.
