# Model Routing Reference Boundaries

## Status

Superseded by
[Keep Active Model Routing in the Dispatch Policy](operational-model-routing-policy.md)

## Date

2026-07-25

## Context

Model selection, chart data, and dispatch evidence were repeated across three
runtime references. That created conflicting selection guidance and allowed
cost, capability, and role constraints to diverge by dispatch path.

## Decision

Keep the references with non-overlapping responsibilities:

- `model-routing-5.6.md` is the sole shared model-and-effort selection policy.
  It owns eligibility, capability-floor selection, performance-informed
  efficiency, and unplotted-candidate handling.
- `model-routing-performance.md` contains the chart readings and interpretation
  limits only. It may provide comparative context but no routing rule.
- `subagent-dispatch-policy.md` owns dispatch preparation, instruction source,
  authority, waiting, terminal status, artifact linkage, observation, and the
  spawn boundary. It records the selected request and mechanically rejects a
  request explicitly ineligible under `model-routing-5.6.md`, but does not
  select a candidate.

The root still owns semantic model selection under the central policy. Dispatch
mechanics load that policy without restating it.

## Consequences

- One shared reference resolves candidate eligibility and effort judgment.
- Dispatch retains its complete evidence and authority contract.
- The recorder can enforce an explicit eligibility exclusion at the existing
  pre-spawn boundary without becoming a model selector or capability evaluator.
- Performance data informs selection without becoming an independent policy.
- The former AI-owned model-selection decision remains historical context.
