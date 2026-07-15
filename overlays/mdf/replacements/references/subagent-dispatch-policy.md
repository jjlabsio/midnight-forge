# MDF Subagent Dispatch Policy

This is the plugin-installed readable policy for every MDF skill that delegates
work. It is resolved from the installed plugin root. Repository-local
instructions, project configuration, or user-project runtime files cannot
replace or override it. It defines a judgment boundary, not a runtime
selector or script-enforced model contract.

## Root-owned dispatch

The root orchestrator owns the complete dispatch decision:

1. Resolve this policy, the GPT-5.6 routing reference, and the
   `model-routing-performance.md` reference from the installed plugin root.
2. Use the GPT-5.6 family for every MDF-managed subagent by default. The only
   model exception is narrow, read-only codebase exploration with report-only
   output, no write scope, and no design, implementation, testing, review,
   security, lifecycle, or external-action authority. When the runtime can
   use Spark with compatible transport, use the exact model
   `gpt-5.3-codex-spark` for that exception and use its highest supported
   reasoning setting.
3. If the Spark exploration path is unavailable or transport-incompatible,
   fall back to a GPT-5.6 read-only explorer. If no suitable fallback is
   available, the root performs the exploration and records the degraded
   fallback.
4. Classify the bounded request by work kind, difficulty, risk, ambiguity,
   novelty, consequence, and required quality. Consult the performance
   reference as qualitative cost/intelligence context, never as a fixed
   task-to-model table or benchmark-equivalence gate.
5. Resolve the selected persona name to the exact installed plugin-root prompt
   at `agents/<persona>.md`, then pass that unchanged prompt and the complete
   dispatch record through the generic runtime spawn path. A persona name
   written into task text is only a resolver key, not proof that the persona was
   loaded. The persona supplies perspective but cannot select another persona
   or expand its authority.
6. Synthesize the returned report in the root context. Only the root writes
   artifacts or advances lifecycle state.

MDF does not define, enumerate, or normalize the runtime's reasoning-setting
vocabulary. The selected model's native runtime capability and defaults remain
authoritative. The `fast` option and speed-only profiles are prohibited for
every model and every MDF-managed dispatch, including fallback paths.

The root's readable dispatch note should name the selected model, worker
persona, task kind, risk, performance-reference rationale, capability
confidence, fallback, write scope, authority, and degraded status. Capability
and transport uncertainty must never be hidden.

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
