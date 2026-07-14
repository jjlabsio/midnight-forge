# AI-Owned Subagent Model Selection

## Status

Accepted

## Date

2026-07-14

## Context

MDF needs to choose a subagent model and effort dynamically when a skill
delegates work. There is no reliable measured quality/cost registry for the
GPT-5.6 profiles, and the supplied intelligence-versus-cost chart is only a
rough routing prior. Treating either as an objective runtime score would make
the harness claim evidence it does not have and would replace the root model's
judgment with a fictitious calculator.

## Decision

The root AI owns model selection. It identifies an eligible GPT-5.6 profile,
applies the user-defined reasoning floor, and subjectively weighs task
difficulty, risk, ambiguity, novelty, consequence, chart context, expected
quality, and cost. The policy defines boundaries and guardrails, not a scoring
formula, benchmark-equivalence gate, or fixed task-to-model table.

The chart may inform the decision, including the possible efficiency of Luna
`xhigh` for bounded work. It must not be presented as measured runtime data or
as proof of semantic equivalence. High-risk work should favor the candidate the
root judges most capable. If no eligible GPT-5.6 capability or compatible
dispatch path exists, the root stops or uses an explicitly degraded fallback.

Persona model and effort settings remain valid defaults for ordinary direct
invocation. For MDF-managed delegation, the root-selected record takes
precedence while the persona prompt and perspective remain unchanged.

## Rejected alternative

Require measured quality/cost signals and select through a Pareto or
benchmark-equivalence calculator. No such reliable signals exist in the target
runtime, so this would either block useful autonomous judgment or encourage
fabricated precision.

## Consequences

- Model choice remains adaptive to the actual task rather than a static table.
- The root must disclose uncertainty when the choice is subjective or the
  available context is weak.
- Quality floors and GPT-5.6/effort/profile restrictions remain explicit,
  while the variant trade-off stays with the AI.
- Mechanical validators may check the surrounding contract, but their selector
  behavior is not the source of truth for runtime model choice.
