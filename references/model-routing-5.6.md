# GPT-5.6 Model Routing Reference

This reference defines the reviewed candidate family for MDF subagent
dispatch. The names below are routing profiles, not fabricated guarantees
about semantic correctness. Runtime capability inspection must verify that a
profile exists before it can be selected.

Persona frontmatter may provide a default model or effort for ordinary direct
invocation. For MDF-managed delegation, the root-selected dispatch record
overrides those defaults while preserving the persona prompt and perspective.

```json
{
  "family": "gpt-5.6",
  "allowed_variants": ["sol", "terra", "luna"],
  "allowed_efforts": ["light", "medium", "high", "xhigh"],
  "forbidden_profile_labels": ["fast", "speed-only"],
  "profiles": [
    {"variant": "sol", "efforts": ["light", "medium", "high", "xhigh"], "quality_signal": "runtime-measured", "cost_signal": "runtime-measured"},
    {"variant": "terra", "efforts": ["light", "medium", "high", "xhigh"], "quality_signal": "runtime-measured", "cost_signal": "runtime-measured"},
    {"variant": "luna", "efforts": ["light", "medium", "high", "xhigh"], "quality_signal": "runtime-measured", "cost_signal": "runtime-measured"}
  ]
}
```

## Frontier signals

- The intelligence/cost chart is a routing signal, not proof of correctness.
  Measured runtime capability and task risk remain authoritative.
- Luna `xhigh` is an efficiency candidate to compare with Terra `high` when
  the runtime evidence says their quality is benchmark-equivalent. It may be
  preferred when its verified cost signal is lower.
- High-risk design, security, review, and doubt-driven work should prefer the
  strongest verified quality signal, even when a cheaper candidate is on the
  frontier.
- `light`, `medium`, `high`, and `xhigh` are the only effort values. Current MDF
  delegation floors filter candidates below `high` (or `xhigh` for design and
  architecture); `fast` and `speed-only` are forbidden profile labels, not
  effort values, and never enter the frontier.

## Image-derived routing insights

The following observations are transcribed from the user-supplied Artificial
Analysis chart, “Intelligence vs. Cost per Intelligence Index Task” (snapshot
provided 2026-07-14). The chart uses a logarithmic cost axis and plots an
Artificial Analysis Intelligence Index against approximate USD cost per task.
These are approximate visual readings, not a machine-readable benchmark and
not guarantees about any particular task.

### What the chart suggests

- The attractive region is the upper-left: higher intelligence index at lower
  cost. It is a frontier heuristic, not a hard eligibility boundary.
- Within each GPT-5.6 family, increasing the plotted effort generally moves
  upward in intelligence and rightward in cost. The trade-off is continuous,
  not a reason to hard-code one effort for every task.
- Luna occupies the lower-cost part of the frontier. Approximate plotted
  points are Luna `medium` ~38 at $0.05, `high` ~46 at $0.09, `xhigh` ~49 at
  $0.14, and `max` ~51 at $0.22.
- Terra is a middle-cost frontier. Approximate plotted points are Terra
  `medium` ~45.5 at $0.16, `high` ~49 at $0.24, `xhigh` ~51.5 at $0.35, and
  `max` ~54.8 at $0.60.
- Sol reaches the highest intelligence values at the highest cost. Approximate
  plotted points are Sol `low` ~49.5 at $0.20, `medium` ~53.5 at $0.32,
  `high` ~55.8 at $0.45, `xhigh` ~57.5 at $0.68, and `max` ~58.8 at $1.02.

### Practical comparisons for autonomous routing

- Luna `xhigh` (~49 at ~$0.14) and Terra `high` (~49 at ~$0.24) appear close
  in intelligence on this chart. Luna is therefore a cost-efficient candidate
  when the task is bounded and the root judges the two profiles equivalent for
  the required quality floor.
- Luna `max` (~51 at ~$0.22) and Terra `xhigh` (~51.5 at ~$0.35) show the same
  general pattern: a cheaper Luna point can be close to a more expensive Terra
  point, but the small index difference is not proof of semantic equivalence.
- Sol should be preferred when risk, novelty, ambiguity, or consequence makes
  additional intelligence more valuable than cost efficiency. This is a
  quality-over-cost judgment, not a fixed Sol-for-task mapping.
- For review, security, doubt-driven, and implementation/testing work, first
  enforce the policy quality floor. Then use these chart relationships as a
  tie-breaker among verified candidates; never choose a cheaper profile solely
  because its plotted point is lower cost.

The chart includes `low` and `max` labels for comparison, but MDF does not add
them to the supported effort contract. MDF-managed dispatch may select only
`light`, `medium`, `high`, or `xhigh`; `fast` and `speed-only` remain forbidden
profile labels. Do not assume the chart's `low` label is identical to MDF's
`light` value. The root may use the chart as prior context while still
considering current runtime capability, task difficulty, risk, and uncertainty.

## Dynamic selection algorithm

1. Reject every capability whose family is not exactly `gpt-5.6`, whose variant
   is not `sol`, `terra`, or `luna`, whose effort is not `light`/`medium`/
   `high`/`xhigh`, or whose profile label is `fast`/`speed-only`.
2. Reject candidates below the work-kind quality floor.
3. For high-risk work, choose the highest verified quality signal, breaking
   ties with cost.
4. Otherwise, compare only benchmark-equivalent candidates at or above the
   floor and choose the lower verified cost signal. This is where Luna `xhigh`
   can beat Terra `high`; the relationship is conditional, not guaranteed.
5. If no candidate remains, stop or use the root fallback with an explicit
   degraded status. Never silently use an older or future model family.

Every dispatch should preserve the selected family, variant, effort, quality
floor, risk, capability evidence, and fallback/degraded outcome for synthesis.
