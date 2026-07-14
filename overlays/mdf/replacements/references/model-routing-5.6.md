# GPT-5.6 Model Routing Reference

This reference defines the reviewed candidate family for MDF subagent
dispatch. The names below are routing profiles, not fabricated guarantees
about semantic correctness. Runtime capability inspection must verify that a
profile exists before it can be selected.

```json
{
  "family": "gpt-5.6",
  "allowed_variants": ["sol", "terra", "luna"],
  "allowed_efforts": ["high", "xhigh"],
  "forbidden_efforts": ["fast", "speed-only"],
  "profiles": [
    {"variant": "sol", "efforts": ["high", "xhigh"], "quality_signal": "runtime-measured", "cost_signal": "runtime-measured"},
    {"variant": "terra", "efforts": ["high", "xhigh"], "quality_signal": "runtime-measured", "cost_signal": "runtime-measured"},
    {"variant": "luna", "efforts": ["high", "xhigh"], "quality_signal": "runtime-measured", "cost_signal": "runtime-measured"}
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
- Sol, Terra, and Luna are all eligible only at `high` or `xhigh`; no fast or
  speed-only profile enters the frontier.

## Dynamic selection algorithm

1. Reject every capability whose family is not exactly `gpt-5.6`, whose variant
   is not `sol`, `terra`, or `luna`, or whose effort is not `high`/`xhigh`.
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
