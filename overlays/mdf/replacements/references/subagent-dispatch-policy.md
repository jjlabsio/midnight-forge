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

## Minimal execution observation

Every MDF-managed generic subagent dispatch records a small append-only
observation in the canonical project's gitignored `.mdf` state. This is
workflow instrumentation, not a runtime contract or a quality score.

Use the per-project file:

```text
<canonical-root>/.mdf/observations/subagent-invocations.jsonl
```

On first use, create only the local `observations/` directory and this
gitignored file as needed. Do not initialize or rewrite `.mdf/project`, task
cards, indexes, locks, or other existing MDF state for instrumentation.

The root writes one JSON object immediately before the generic spawn and one
terminal JSON object after the worker returns. Capture the return timestamp
immediately when the worker returns, then materialize the direct result
artifact and write the terminal object with that captured timestamp. This
keeps artifact linkage reliable without calculating elapsed time or delaying
the observed completion timestamp. The two objects share `invocation_id`:

```json
{"event":"dispatch","invocation_id":"<unique-id>","requested_model":"<selected-model>","requested_effort":"<native-setting>","work_id":null,"status":"dispatched","dispatched_at":"<observed-UTC-timestamp>"}
{"event":"terminal","invocation_id":"<same-id>","status":"completed|failed|timed_out|interrupted","completed_at":"<observed-UTC-timestamp>","artifact_refs":["<project-relative-result-artifact>"]}
```

`artifact_refs` is optional only when no result artifact exists; use an empty
array for a known artifact-free result. Paths are project-relative and must
not contain absolute paths, traversal, prompts, responses, or secrets.
`work_id` is the existing MDF work-item identity when one exists, not a new
task classification.

The observation contains only requested model/effort, invocation identity,
existing work linkage, terminal status, timestamps, and result-artifact
references. Never add orchestrator model/effort, host-reported actual
model/effort, task-factor judgments, rationale, or manual review fields. Do
not calculate elapsed time during workflow execution. The project-level
analysis skill derives dispatch-to-return duration from the two observed
timestamps.

The root is the sole writer for these lines, including when dispatches run in
parallel. This is an automatic step at the shared MDF generic-dispatch
boundary, not a user-entered review command and not a host-runtime hook. Every
delegating skill that reaches that boundary follows this same record-before,
record-after sequence. If a dispatch or terminal line cannot be recorded,
continue only when the workflow itself remains safe and let the analysis
report the missing observation as insufficient evidence; never reconstruct it
from memory or host metadata. A dispatch without a terminal event is an
incomplete/censored observation, not a successful result.

## Condition-based completion and fan-out joins

- Wait for the actual worker response before consuming a subagent report. The
  generic runtime must return the response and the caller must be able to read
  the report or its declared result artifact.
- Treat a terminal observation as insufficient when the response or required
  report is absent, even when it says `status: "completed"`.
- Use event- or return-based waiting when the executor exposes it.
- Use an elapsed time limit only as a safety guard for an unavailable or
  unhealthy executor; never use it as evidence that the worker completed.
- Treat `timed_out`, `interrupted`, `failed`, a missing terminal event, and a
  missing or partial report as non-success. Do not hide the same
  completion-contract failure by increasing a guessed timeout.
- For a fan-out, join every required worker's actual report instead of
  counting dispatches or terminal lines.
- Retain partial reports as diagnostic evidence when useful, but do not
  synthesize them as a complete result, advance the consuming stage, or issue
  a normal GO recommendation until every required report has returned.
- Route a missing or non-success report through the caller's explicit
  incomplete/degraded or stop path.
- Keep this policy model-led. Do not add a runtime controller, heartbeat,
  retry service, or host-side cleanup mechanism.

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
