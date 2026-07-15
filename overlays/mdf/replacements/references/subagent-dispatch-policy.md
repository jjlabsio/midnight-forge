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
5. Resolve the selected persona name to the exact installed plugin-root prompt
   at `agents/<persona>.md`, then pass that unchanged prompt and the complete
   dispatch record through the generic runtime spawn path. A persona name
   written into task text is only a resolver key, not proof that the persona was
   loaded. The persona supplies perspective but cannot select another persona
   or expand its authority.
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

Persona prompt content and perspective remain intact. The generic runtime path
is MDF-compatible only when it receives the exact installed persona prompt and
the root-selected dispatch record. If the prompt or dispatch transport cannot
be resolved, use a visible degraded root fallback or stop.

## Spawn boundary

Delegating skills pass these fields through the generic runtime path:

```text
model choice: <root-selected candidate>
persona: <exact installed persona prompt, unchanged>
task input: <bounded artifact and contract>
```

Capability failure, fallback, and degraded freshness belong in the root's
readable report. When the choice is uncertain, the root may disclose its
reasoning and uncertainty; do not invent measured quality/cost evidence. Never
infer a successful independent review from a fallback or from a persona name
alone.
