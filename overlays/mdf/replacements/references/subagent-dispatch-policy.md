# MDF Subagent Dispatch Policy

Readable policy for MDF-managed delegation. It guides root judgment; it is not
a runtime selector or controller.

## Select

1. Load this policy, `model-routing-5.6.md`, and
   `model-routing-performance.md` from the installed plugin root.
2. Select the smallest suitable candidate from boundedness, ambiguity, risk,
   consequence, verification demand, required quality, runtime support,
   transport compatibility, and one-person-builder feedback costs.
3. Apply `model-routing-5.6.md`. Do not invent another difficulty scale, fixed
   task-to-model table, benchmark equivalence, fast profile, or silent downgrade.
4. Record one compact dispatch entry in the existing root handoff:
   - requested model and effort;
   - qualitative selection and effort rationale, including performance-reference
     context and feedback costs;
   - concrete Sol high-or-higher escalation reason when applicable;
   - instruction source and task kind;
   - risk, capability confidence, and write scope;
   - fallback and degraded status.

Use Terra as the ordinary prior for implementation and review. For narrow,
clear work needing precise code understanding, Terra medium or high and Sol
low are valid candidates when they independently clear the operation's floor.
Use Sol medium or above only with the concrete task characteristic or observed
failure required by `model-routing-5.6.md`; Sol high or higher also needs its
recorded concrete escalation reason. Use `gpt-5.3-codex-spark` only for the
narrow read-only exploration exception in `model-routing-5.6.md`; it cannot serve as a workflow
critic.

## Instruction source

| Source | Use | Input |
| --- | --- | --- |
| `skill-backed` | Workflow executor or critic | Exact canonical adapter; the called adapter loads the primitives required by its public contract |
| `persona-backed` | A canonical skill explicitly names a specialist | Exact installed persona prompt, unchanged |

Do not create a separate routing artifact or repeat task and skill bodies.

## Dispatch

- Follow `auto-workflow-contract.md` for executor/critic order, authority,
  observation, acceptance, and rework.
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
