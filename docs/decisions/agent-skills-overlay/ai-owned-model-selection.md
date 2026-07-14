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
judgment with a fictitious calculator. Auto-workflow also benefits from a
small, bounded exploration fan-out, but exploration must not silently gain
design, implementation, or external-action authority.

## Decision

The root AI owns model selection for quality-critical work. It identifies an
eligible GPT-5.6 profile,
applies the user-defined reasoning floor, and subjectively weighs task
difficulty, risk, ambiguity, novelty, consequence, chart context, expected
quality, and cost. The policy defines boundaries and guardrails, not a scoring
formula, benchmark-equivalence gate, or fixed task-to-model table.

There is one explicit exception: narrow, read-only codebase exploration may
prefer `gpt-5.3-codex-spark` when the runtime capability and transport have
been verified compatible. Such a worker is report-only, has no write scope,
and cannot decide design, security, implementation, lifecycle, or external
actions. If Spark transport is unavailable or rejects the required request,
the root selects a verified GPT-5.6 read-only candidate; if none exists, the
root performs the exploration itself in degraded mode.

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
- Quality-critical paths retain GPT-5.6/effort/profile restrictions, while the
  variant trade-off stays with the AI.
- Spark exploration is useful only as a bounded context-saving optimization;
  it never becomes a semantic authority or a required dependency.
- Mechanical validators may check the surrounding contract, but their selector
  behavior is not the source of truth for runtime model choice.
