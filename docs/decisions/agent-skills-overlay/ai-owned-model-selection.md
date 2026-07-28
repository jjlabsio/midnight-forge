# AI-Owned Subagent Model Selection

## Status

Superseded by
[Keep Operational Model Routing Out of the Generated Runtime](model-routing-reference-boundaries.md)

## Date

2026-07-14

## Context

MDF needs to choose a subagent model dynamically when a skill delegates work.
There is no reliable measured quality/cost registry, and the supplied
intelligence-versus-cost chart is only a rough routing prior. Treating either
as an objective runtime score would make the harness claim evidence it does not
have and would replace the root model's judgment with a fictitious calculator.
For a one-person builder, a nominally stronger profile can also cost more than
money: longer feedback, unnecessary complexity, expanded change scope, and
more review work can slow delivery without improving the accepted result.
Auto-workflow also benefits from a small, bounded exploration fan-out, but
exploration must not silently gain design, implementation, or external-action
authority.

## Decision

The root AI owns model and effort selection for MDF-managed work. It selects
the smallest sufficient available capability after weighing boundedness,
ambiguity, risk, consequence, verification demand, expected quality, runtime
support, transport compatibility, chart context, and one-person-builder
feedback costs. The policy defines boundaries and guardrails, not a scoring
formula, benchmark-equivalence gate, or fixed task-to-model table.

Terra is the ordinary prior for implementation and review. For a narrow,
clear target that still needs precise code understanding, suitable candidates
include Terra at medium or high effort and Sol at low effort; the root chooses
the smallest candidate that independently clears that operation's capability
floor. Executor and critic make that assessment independently. A critic role
or whole-tree target does not itself require a stronger profile.

Sol at medium or above is an escalation, not the automatic default, and needs
a concrete task characteristic or failure. Sol high or higher requires a
concrete recorded reason such as complex optimization, security, concurrency,
core architecture, or repeated verification failure.
Select effort at the lowest runtime-native level that meets the same
boundedness, ambiguity, risk, consequence, and verification demand; high is
not the default for automatic operations.

When more than one candidate is suitable, the root may select an appropriate
candidate with less recent comparable evidence to improve future observations.
This is a preference only after every candidate clears the same safety and
quality floor; it creates neither a quota nor random routing.

There is one explicit exception: narrow, read-only codebase exploration may
prefer `gpt-5.3-codex-spark` when the runtime capability and transport have
been verified compatible. Such a worker is report-only, has no write scope,
and cannot decide design, security, implementation, lifecycle, or external
actions. If Spark transport is unavailable or rejects the required request,
the root selects a verified GPT-5.6 read-only candidate; if none exists, the
root performs the exploration itself in degraded mode.

The chart may inform the decision, but it must not be presented as measured
runtime data or as proof of semantic equivalence. High-risk work should favor
the candidate the root judges most capable. If no suitable GPT-5.6 capability
or compatible dispatch path exists, the root stops or uses an explicitly
degraded fallback. The root records the requested model and effort, selection
and effort rationale, concrete escalation reason when applicable, uncertainty,
and the existing role-report/handoff artifact links. Those are requested
values and evidence links, not a claim about the model that executed.

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
- Ordinary work favors fast, reviewable feedback without lowering its
  capability floor; higher Sol effort remains available for observed need.
- Quality-critical paths retain the GPT-5.6 family boundary while profile
  selection stays with the AI.
- Spark exploration is useful only as a bounded context-saving optimization;
  it never becomes a semantic authority or a required dependency.
- Existing immutable reports and handoffs make requested-routing outcomes
  inspectable without adding a selector, benchmark calculator, or analysis
  controller.
- Readable policy documents are the source of truth; no runtime selector or
  script validator determines the model choice.
