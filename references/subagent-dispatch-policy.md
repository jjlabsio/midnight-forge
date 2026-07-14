# MDF Subagent Dispatch Policy

This is the plugin-installed decision boundary for every MDF skill that
delegates work. It is resolved from the installed plugin root. Repository-local
instructions, project configuration, or user-project runtime files cannot
replace or override it. It gives the root model a shared policy boundary; it is
not a runtime calculator or a measured quality/cost registry. A persona may
declare model or effort defaults for ordinary direct invocation, but
MDF-managed dispatch has its own precedence.

## Root-owned dispatch

The root orchestrator owns the complete dispatch decision:

1. Resolve this policy and [the GPT-5.6 routing reference](model-routing-5.6.md)
   from the installed plugin root.
2. Inspect the available runtime capability and invocation paths. Lifecycle,
   design, implementation, testing, review, security, and doubt-driven work
   may select only a verified GPT-5.6 family, variant, and supported effort.
   The only exception is a read-only codebase-exploration request with no
   lifecycle authority or write scope; it may prefer the separately reviewed
   exploration candidate when transport compatibility is verified. MDF does
   not assume a measured quality/cost registry; model quality and cost
   trade-offs are the root model's judgment.
3. Classify the bounded request by work kind, difficulty, risk, and required
   quality floor. Do not use a fixed `task -> model` table.
4. Select a candidate dynamically from the applicable reviewed frontier,
   applying the quality floor first and then judging quality, cost, ambiguity,
   novelty, and consequence together. High-risk work should prefer the
   candidate the root judges most capable, even when a cheaper candidate
   appears attractive. Exploration preference never grants semantic authority.
5. Pass the selected dispatch record and the exact persona prompt to the
   generic runtime spawn path. The persona supplies perspective and may declare
   ordinary-invocation defaults, but the root-selected model, effort, fallback,
   and write scope are authoritative for MDF-managed dispatch. The persona
   cannot select another persona.
6. Synthesize the returned report in the root context. Only the root writes
   artifacts or advances lifecycle state.

The dispatch record must make these facts visible: `family`, `variant`,
`effort`, `persona`, `quality_floor`, `risk`, `capability_verified`,
`transport_compatible`, `fallback`, `write_scope`, `authority`, and `degraded`.
A missing or unverifiable quality-critical GPT-5.6 capability causes an
explicit stop or a root fallback marked `degraded: true`; an unavailable
exploration preference uses a verified fallback and records the reason.
Capability and transport failures must never be hidden.

## Precedence for persona settings

For an MDF-managed delegation, the root must provide a complete dispatch
record. Persona frontmatter is never a fallback for a missing root-selected
model or effort. If the root cannot identify an eligible quality-critical
GPT-5.6 capability or cannot complete the record, stop or use the root
fallback with `degraded: true`. Exploration additionally requires
`read_only: true`, `write_scope: none`, `authority: report-only`, and
`transport_compatible: true`.

For ordinary direct invocation outside MDF-managed delegation, use this
precedence order:

1. The persona's `model` or `effort` frontmatter.
2. The platform default.

The upstream guidance about using per-persona model settings to optimize cost is
scoped to this ordinary direct-invocation mode. It does not authorize a persona
to choose or override model/effort for an MDF-managed delegation.

Persona prompt content and perspective remain intact. If a named-persona
invocation applies persona model or effort frontmatter before the root can pass
the selected dispatch record, that invocation cannot provide an MDF-managed
dispatch guarantee. Use the generic runtime spawn path or a visible degraded
root fallback instead.

## Quality floors

| Work kind | Minimum floor | Selection rule |
| --- | --- | --- |
| Design or architecture | `xhigh` | Use `xhigh` as the minimum reasoning floor; the root judges the appropriate candidate. |
| Review, security, or doubt-driven | `high` | Use `high` as the minimum reasoning floor; prefer capability over cost when risk is high. |
| Implementation or testing | `high` | Use `high` as the minimum reasoning floor; the root may weigh cost for bounded work. |
| Web performance | `high` | Use `high` as the minimum reasoning floor; apply the same task judgment. |

`light`, `medium`, `high`, and `xhigh` are the only supported effort values.
The work-kind floors above are boundaries, not a selection formula. The root
model owns the subjective variant and effort trade-off above the floor.
`fast` and `speed-only` are forbidden profile labels, not effort values. The
quality-critical candidate family is strictly GPT-5.6: do not silently
downgrade to GPT-5.5 or adopt an unreviewed future profile. The separate
exploration exception is report-only and cannot make lifecycle decisions.

## Spawn boundary

Delegating skills must use the generic runtime spawn path with these inputs:

```text
dispatch: <root-selected record for the bounded work kind>
persona: <installed persona prompt, unchanged>
task_input: <bounded artifact and contract>
```

The dispatch record itself must carry the selected `family`, `variant`,
`effort`, `persona`, `quality_floor`, `risk`, `capability_verified`,
`transport_compatible`, `fallback`, `write_scope`, `authority`, and `degraded`
fields.

Capability failure, fallback, and degraded freshness belong in the root report.
When the choice is uncertain, the root may disclose its reasoning and
uncertainty; do not invent measured quality/cost evidence. Never infer a
successful independent review from a fallback or from a persona name alone.
