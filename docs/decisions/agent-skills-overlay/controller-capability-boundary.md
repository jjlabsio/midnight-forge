# Keep Model and Freshness Judgment at the Orchestrator Boundary

## Status

Accepted

## Date

2026-07-12

## Context

The MDF adapter records executor, persona, model capability, and freshness
claims for upstream reviews and other specialist work. A review suggested that
the controller should reject any result unless it could independently prove
the model's quality and the reviewer's fresh context.

The controller cannot observe those semantic properties deterministically. A
stricter check would validate caller-supplied flags rather than the underlying
reasoning, add protocol ceremony, and risk replacing the upstream workflow with
a second incomplete implementation. It would also reduce the orchestrator's
ability to choose the strongest available model or use an explicit root
fallback when subagents are unavailable.

## Decision

The root orchestrator owns model selection, reviewer choice, and the decision to
use root fallback. The controller records the declared execution mode
(`fresh`, `root-fallback`, or `degraded`) and checks only mechanically observable
consistency and provenance:

- the selected skill and persona are the exact resolved files;
- inputs, outputs, and Git tree are current and bound to the decision;
- executor and execution-mode fields are internally consistent;
- lifecycle, scope, replay, and one-writer constraints hold.

The controller does not independently prove model quality, context isolation,
or semantic review independence. Execution mode must be recorded truthfully and
must not be relabeled, but a missing host-level proof is not itself a controller
failure. The orchestrator applies the exact upstream policy for whether a
degraded result may advance.

## Alternatives Considered

### Enforce fresh capability at every controller gate

- Pros: presents a stronger-looking automatic quality gate.
- Cons: cannot prove the underlying property when the runtime only receives
  caller-supplied claims; encourages validator theater and duplicates upstream
  semantic judgment.
- Rejected because the controller would appear stricter without providing
  equivalent evidence and would unnecessarily restrict root fallback.

### Ignore executor and freshness data entirely

- Pros: maximum autonomy and minimal protocol.
- Cons: loses provenance, makes stale or internally inconsistent handoffs harder
  to diagnose, and permits execution mode to be silently misrepresented.
- Rejected because mechanical provenance and truthful mode recording remain
  valuable safety facts.

## Consequences

- Reviews must not raise a blocker merely because the adapter cannot prove model
  quality or fresh context at the host level.
- Reviews should still flag skipped upstream primitives, mislabeled execution
  modes, stale or mismatched evidence, and lifecycle or scope bypasses.
- Model quality and fallback policy remain explicit orchestration decisions,
  preserving upstream workflow intent without making the controller distrust the
  agent's semantic work by default.
