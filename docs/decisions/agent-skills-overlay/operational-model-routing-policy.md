# Keep Active Model Routing in the Dispatch Policy

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

`references/subagent-dispatch-policy.md` directly contains the sole active,
minimal model-and-effort guidance for MDF-managed requests. The root reads and
applies that runtime reference before dispatch, retains semantic judgment, and
records requested—not executed—routing facts and a concise rationale.

The generated `references/model-routing-5.6.md` and
`references/model-routing-performance.md` surfaces, their overlay inputs, and
their inventory entries are removed. There is no replacement model-routing
runtime reference and no runtime load from `docs/**`. The recorder retains only
a narrow pre-dispatch guard for explicitly ineligible model, effort, or
requested-mode facts, before invocation-ID allocation, journal append, or
spawn. The sole canonical requested mode is `standard`; `fast` and unknown
modes are ineligible for MDF-managed dispatch. That guard is not a policy
parser, selector, capability scorer, or model-to-role table.

Chart readings, external benchmarks, and factual MDF observations remain in
non-runtime research, operations, and decision documents as evidence for a
later manual policy revision. They may not automatically select, recommend, or
change a candidate.

## Consequences

- There is one readable active-policy source in the generated dispatch runtime
  reference.
- The root must contain scope before escalating effort and retains selection
  accountability.
- Explicitly forbidden Luna, Sol, and requested-mode requests still fail
  mechanically at the existing pre-spawn boundary.
- Historical evidence remains inspectable with source, date, metric scope, and
  limits, but cannot be mistaken for live runtime telemetry.
- Upstream workflow semantics and requested-versus-executed boundaries remain
  unchanged.
