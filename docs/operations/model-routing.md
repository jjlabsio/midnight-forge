# Model Routing Policy

This is the single authoritative active policy for MDF-managed subagent model
and effort requests. The root makes the semantic selection for each bounded
dispatch; this policy is guidance, not a runtime routing controller, benchmark
calculator, capability scorer, or model-to-role table.

## Eligibility

- Never request any GPT-5.6 Luna candidate.
- Never request `gpt-5.6-sol` at `medium` or above. `gpt-5.6-sol` is eligible
  only at `low`.
- Terra `high` is not a general selection candidate.

The dispatch recorder rejects the first two explicit exclusions before it
issues an invocation ID, appends a journal event, or permits a spawn. That
small mechanical guard does not decide whether an otherwise eligible request
is appropriate.

## Select the minimum sufficient candidate

Use this candidate ladder only after defining a bounded task and its capability
floor:

1. Terra `medium`
2. Sol `low`
3. Terra `xhigh`
4. Terra `max`

Choose the lowest eligible candidate that clears the concrete floor. Terra
`xhigh` and `max` require a stated capability-floor reason, such as material
ambiguity that remains after clarification, high consequence of an error,
non-trivial verification difficulty, or an observed failure of a lower rung.
They are never automatic promotions for a role name, large tree, generic
quality preference, future possibilities, or polish beyond acceptance.

Total feedback cost includes model-use cost, time to a usable result,
rework and review burden, and unnecessary scope expansion. A chart score or
other benchmark is only historical context; it cannot override direct,
comparable operating evidence or the accepted task boundary.

## Contain scope before escalation

Before increasing effort or moving up the ladder:

1. Split a broad request into independently bounded work, or clarify an
   ambiguous request.
2. State the acceptance boundary, verification method, and out-of-scope work
   in the dispatch input.
3. If satisfying the request needs scope expansion, surface that decision to
   the root or user instead of silently implementing it.

The root records the requested model and effort plus a compact selection
rationale. Requested values are not evidence of the model that executed. The
root alone judges task meaning, scope, and whether a candidate clears its
floor; a dispatch worker or observation analysis does not gain that authority.

## Evidence and policy changes

[Historical routing evidence](../research/model-routing-evidence.md) and
[model-routing analysis](model-routing-analysis.md) may inform a manual policy
revision. They do not select a request or automatically recommend a change.
Record an explicit decision when changing this policy, then update the narrow
pre-dispatch guard if an eligibility exclusion changes.
