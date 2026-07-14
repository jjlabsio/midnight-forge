# MDF Subagent Dispatch Policy

This is the plugin-installed dispatch contract for every MDF skill that
delegates work. It is resolved from the installed plugin root. Repository-local
instructions, project configuration, persona frontmatter, or user-project
runtime files cannot replace or override it.

## Root-owned dispatch

The root orchestrator owns the complete dispatch decision:

1. Resolve this policy and [the GPT-5.6 routing reference](model-routing-5.6.md)
   from the installed plugin root.
2. Verify the runtime capability registry. A capability is usable only when
   the runtime can identify its GPT-5.6 family, variant, effort, and measured
   quality/cost signals.
3. Classify the bounded request by work kind, difficulty, risk, and required
   quality floor. Do not use a fixed `task -> model` table.
4. Select a candidate dynamically from the GPT-5.6 frontier, applying the
   quality floor first and cost efficiency second. High-risk work prefers the
   strongest verified candidate over a cheaper equivalent.
5. Pass the selected dispatch record and the exact persona prompt to the
   generic runtime spawn path. The persona supplies perspective only; it never
   selects a model, effort, fallback, or another persona.
6. Synthesize the returned report in the root context. Only the root writes
   artifacts or advances lifecycle state.

The dispatch record must make these facts visible: `family`, `variant`,
`effort`, `persona`, `quality_floor`, `risk`, `capability_verified`, and
`degraded`. A missing or unverifiable GPT-5.6 capability causes an explicit
stop or a root fallback marked `degraded: true`; it must never be hidden.

## Quality floors

| Work kind | Minimum floor | Selection rule |
| --- | --- | --- |
| Design or architecture | `xhigh` | Prefer the strongest verified quality signal. |
| Review, security, or doubt-driven | `high` | Prefer quality over cost when risk is high. |
| Implementation or testing | `high` | A cheaper candidate is allowed only when measured quality is equivalent. |
| Web performance | `high` | Use the same risk and evidence rules as implementation. |

`high` and `xhigh` are reasoning requirements, not claims that a model is
correct. Fast or speed-only profiles are forbidden. The candidate family is
strictly GPT-5.6: do not silently downgrade to GPT-5.5 or adopt an unreviewed
future profile.

## Spawn boundary

Delegating skills must use the generic runtime spawn path with these inputs:

```text
dispatch: <root-selected GPT-5.6 record>
persona: <installed persona prompt, unchanged>
task_input: <bounded artifact and contract>
write_scope: report-only
```

Capability failure, fallback, and degraded freshness belong in the root report.
Never infer a successful independent review from a fallback or from a persona
name alone.
