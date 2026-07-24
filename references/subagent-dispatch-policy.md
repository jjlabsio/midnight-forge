# MDF Subagent Dispatch Policy

Dispatch, authority, and observation contract for a root-selected MDF-managed
subagent. This reference does not select its model or effort and is not a
runtime selector or controller.

## Prepare a dispatch

1. Resolve the installed plugin root. Before selecting model or effort for any
   MDF-managed subagent request, load and apply
   `<plugin-root>/references/model-routing-5.6.md`.
2. Record one compact dispatch entry in the existing root handoff:
   - requested model and effort;
   - qualitative selection and effort rationale, including performance-reference
     context and feedback costs;
   - instruction source and task kind;
   - risk, capability confidence, and write scope;
   - fallback and degraded status.

## Instruction source

| Source | Use | Input |
| --- | --- | --- |
| `skill-backed` | Workflow executor or critic | Exact canonical adapter; the called adapter loads the primitives required by its public contract |
| `persona-backed` | A canonical skill explicitly names a specialist | Exact installed persona prompt, unchanged |

Do not create a separate routing artifact or repeat task and skill bodies.

## Dispatch

- Follow `<plugin-root>/references/automatic-operation-contract.md` for
  executor/critic order, authority, observation, acceptance, and rework.
- Keep one writer per shared worktree.
- Wait for every dispatched subagent's actual terminal response. A caller-side
  wait timeout, no update, or elapsed silence is not terminal or failure
  evidence: while the subagent remains running, keep waiting, do not interrupt
  it merely for slowness or silence, and do not dispatch a replacement writer
  before the prior writer is terminal.
- Join every required fan-out report before root synthesis.
- Preserve partial reports only as diagnostics.
- Treat failed, timed-out, interrupted, missing, or incomplete results as
  non-success.
- Use a visible root fallback only when the caller permits degraded execution;
  never claim independent freshness.
- Preserve ship's canonical parallel specialist fan-out and root merge; do not
  use an executor/critic pair for ship.
- Add no heartbeat, retry, cleanup, or orchestration service.

## Mandatory minimal observation

Generate a globally unique invocation ID. Before spawn:

```bash
node <plugin-root>/skills/use-mdf/scripts/record-subagent-observation.mjs \
  <canonical-root> dispatch <invocation-id> <requested-model> \
  <requested-effort> <work-id-or-dash>
```

After an actual terminal response:

```bash
node <plugin-root>/skills/use-mdf/scripts/record-subagent-observation.mjs \
  <canonical-root> terminal <invocation-id> <raw-status> [artifact-ref...]
```

Observation rules:

- Use the canonical work ID for task-linked work; use `-` only when unlinked.
- Record the raw terminal status verbatim. If none exists, leave the dispatch
  incomplete.
- Do not retry a successful append, reuse an invocation ID, or reconstruct a
  missing terminal fact.
- Link the persisted role report in the terminal append, then use the existing
  immutable role-specific handoff attempt line for the same invocation. Link a
  handoff in the terminal append too when it already exists. These are the
  method-authorized artifact links for later routing analysis; do not create a
  synthetic routing artifact or copy report prose.
- Do not store prompts, responses, secrets, quality scores, synthetic difficulty
  labels, or inferred runtime facts.
- Record `requested_model` and `requested_effort` as requested values. The
  runtime does not report the model that actually executed.
- Block stage closure on append failure until the missing event is recorded.

The helper supplies UTC timestamps and one `O_APPEND` write. An observation
never proves a returned report, changes terminal status, or grants authority.

## Spawn boundary

```text
model choice: <root-selected candidate>
instruction source: skill-backed | persona-backed
canonical skill: <exact adapter>                       # skill-backed
persona: <exact installed prompt>                      # persona-backed
task input: <bounded target and contract>
```
