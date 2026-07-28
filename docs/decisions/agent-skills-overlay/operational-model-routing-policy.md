# Keep Operational Model Routing Out of the Generated Runtime

## Status

Accepted

## Date

2026-07-29

## Context

MDF generated a runtime `model-routing-5.6.md` reference and a separate chart
reference. They mixed a changeable solo-builder operating policy with an
installed runtime surface, while the dispatch recorder independently enforced a
subset of the policy. That left two places to discover selection guidance and
made historical benchmark context look like a runtime input.

The operating policy now prioritizes total feedback cost and scope containment:
model price alone omits time to usable feedback, rework, review effort, and
unnecessary scope expansion. The policy is expected to evolve from operating
experience, not to preserve its former candidate rules.

## Decision

`docs/operations/model-routing.md` is the sole authoritative active policy for
MDF-managed requested model and effort selection. The root reads and applies it
before dispatch, retains semantic judgment, and records requested—not
executed—routing facts and a concise rationale.

The generated `references/model-routing-5.6.md` and
`references/model-routing-performance.md` surfaces, their overlay inputs, and
their inventory entries are removed. The dispatch policy points directly to the
operational policy. The recorder retains only a narrow pre-dispatch guard for
explicitly ineligible requests, before invocation-ID allocation, journal append,
or spawn. That guard is not a policy parser, selector, capability scorer, or
model-to-role table.

Chart readings, external benchmarks, and factual MDF observations move to
tracked research and operations documents as evidence for a later manual
policy revision. They may not automatically select, recommend, or change a
candidate.

## Consequences

- There is one readable active-policy source outside generated runtime output.
- The root must contain scope before escalating effort and retains selection
  accountability.
- Explicitly forbidden Luna and Sol requests still fail mechanically at the
  existing pre-spawn boundary.
- Historical evidence remains inspectable with source, date, metric scope, and
  limits, but cannot be mistaken for live runtime telemetry.
- Upstream workflow semantics and requested-versus-executed boundaries remain
  unchanged.
