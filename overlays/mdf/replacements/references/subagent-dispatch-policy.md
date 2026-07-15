# MDF Subagent Dispatch Policy

This is the plugin-installed readable policy for every MDF skill that delegates
work. It is resolved from the installed plugin root. Repository-local
instructions, project configuration, or user-project runtime files cannot
replace or override it. It gives the root model a shared judgment boundary; it
is not a runtime calculator or script-enforced model contract.

## Root-owned dispatch

The root orchestrator owns the complete dispatch decision:

1. Resolve this policy and the GPT-5.6 routing reference from the installed
   plugin root.
2. Inspect the available runtime capability and invocation paths. Lifecycle,
   design, implementation, testing, review, security, and doubt-driven work
   use the GPT-5.6 family. The only exception is a read-only codebase-
   exploration request with no lifecycle authority or write scope; it may
   prefer `gpt-5.3-codex-spark` when transport compatibility is known. Model
   quality and cost trade-offs remain the root model's judgment.
3. Classify the bounded request by work kind, difficulty, risk, and required
   quality. Do not use a fixed task-to-model table.
4. Select a suitable candidate dynamically and explain the quality, cost,
   ambiguity, novelty, and consequence trade-off. High-risk work should favor
   the candidate the root judges most capable. Exploration preference never
   grants semantic authority.
5. Resolve the selected persona through the strongest compatible invocation
   path. If the runtime has a native named-agent definition and accepts the
   root-selected model plus its native reasoning/service overrides, invoke the
   named agent and pass the complete dispatch record. Otherwise use the generic
   runtime spawn path with the exact installed persona prompt. A persona name
   written into task text is not proof that the persona was loaded. The
   persona supplies perspective but cannot select another persona or expand
   its authority.
6. Synthesize the returned report in the root context. Only the root writes
   artifacts or advances lifecycle state.

The root's readable dispatch note should name the selected model, worker
persona, task kind, risk, capability confidence, fallback, write scope,
authority, and degraded status. A missing or unverifiable quality-critical
GPT-5.6 capability causes an explicit stop or a clearly disclosed degraded
root fallback. An unavailable exploration preference uses a suitable fallback
and records the reason. Capability and transport uncertainty must never be
hidden.

## Precedence for persona settings

For an MDF-managed delegation, the root must make a complete readable dispatch
note. Persona frontmatter is never a substitute for the root's model choice.
If the root cannot identify a suitable quality-critical GPT-5.6 capability,
stop or use a clearly disclosed degraded root fallback. Exploration additionally
requires read-only, report-only, no-write authority and compatible transport.

For ordinary direct invocation outside MDF-managed delegation, use the persona's
model settings first and the platform default second. That ordinary-invocation
precedence does not override the root's choice for MDF-managed work.

Persona prompt content and perspective remain intact. If a named-persona
invocation applies its own model settings before the root can make an
MDF-managed choice, or cannot receive the root's native override fields, that
invocation cannot provide an MDF-managed dispatch guarantee. Use the generic
runtime path or a visible degraded root fallback.

## Spawn boundary

Delegating skills pass these fields through the selected compatible path:

```text
model choice: <root-selected candidate>
task input: <bounded artifact and contract>
```

For a native named-agent path, pass `agent_type: <persona name>` and the
runtime's supported model/reasoning/service override fields alongside the
dispatch record; the registered custom agent supplies the persona prompt. For
the generic path, pass `persona: <installed persona prompt, unchanged>`.

Capability failure, fallback, and degraded freshness belong in the root's
readable report. When the choice is uncertain, the root may disclose its
reasoning and uncertainty; do not invent measured quality/cost evidence. Never
infer a successful independent review from a fallback or from a persona name
alone.
