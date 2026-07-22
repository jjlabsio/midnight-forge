# MDF Subagent Dispatch Policy

Use this readable policy for MDF-managed delegation. It guides model judgment;
it is not a runtime selector or controller.

## Root-owned dispatch

1. Resolve this reference, `model-routing-5.6.md`, and
   `model-routing-performance.md` from the installed plugin root.
2. Select suitable capability from difficulty, risk, ambiguity, novelty,
   consequence, required quality, runtime support, and transport compatibility.
3. Use `skill-backed` instructions for workflow executors and critics: pass the
   exact canonical adapter plus every applicable primitive selected by upstream
   `using-agent-skills` discovery.
4. Use `persona-backed` instructions only when a canonical skill explicitly
   names a specialist. Resolve the exact installed persona prompt unchanged.
5. Keep one writer in a shared worktree. Only the root accepts results, writes
   canonical workflow state, commits, advances lifecycle, performs external
   actions, and synthesizes the workflow.
6. Record the selected model and effort, qualitative selection rationale,
   instruction source, task kind, risk, capability confidence, write scope,
   fallback, and degraded status in a readable note. Apply
   `model-routing-5.6.md`; do not invent a second difficulty scale or fixed
   task-to-model table.

Keep the dispatch note to one compact entry in the existing root handoff. Do
not create a separate routing artifact or repeat the task and skill bodies.

Use a GPT-5.6 family capability by default for quality-critical work. Never use
a fast profile, fixed stage-to-model table, benchmark equivalence, or silent
downgrade. Narrow read-only exploration may use `gpt-5.3-codex-spark` when its
transport is compatible; it cannot serve as a workflow critic.

## Executor and critic

For an operation pair defined by `auto-workflow-contract.md`:

1. Dispatch one bounded executor with the exact target and write scope.
2. Wait for its actual terminal response. Do not infer completion from timeout,
   cancellation, an observation line, or missing output.
3. Re-read the artifact or diff, Git state, and command results in the root.
4. Dispatch a distinct fresh read-only critic with the original acceptance
   baseline and root-observed target. Exclude executor reasoning.
5. The critic assesses the target itself, cannot delegate, and cannot write,
   commit, accept, advance lifecycle, or perform external actions.
6. The root reconciles the result and chooses the next operation. Missing,
   partial, stale, changed-target, or non-independent output does not pass.

For ship, do not use this pair. Preserve its canonical parallel specialist
fan-out and root merge.

## Completion and fan-out

- Consume only actual returned reports.
- Join every required report before synthesizing a fan-out result.
- Preserve partial reports only as diagnostics.
- Treat failed, timed-out, interrupted, missing, or incomplete results as
  non-success.
- Use a visible root fallback only when the calling contract permits degraded
  execution; never claim independent freshness for it.
- Do not add heartbeat, retry, cleanup, or orchestration services.

## Mandatory minimal observation

For each generic dispatch, generate a globally unique invocation ID. Use the
installed single-write append helper to record one dispatch before spawn:

```bash
node <plugin-root>/skills/use-mdf/scripts/record-subagent-observation.mjs \
  <canonical-root> dispatch <invocation-id> <requested-model> \
  <requested-effort> <work-id-or-dash>
```

After an actual terminal response, record its raw runtime status verbatim and
zero or more project-relative artifact references:

```bash
node <plugin-root>/skills/use-mdf/scripts/record-subagent-observation.mjs \
  <canonical-root> terminal <invocation-id> <raw-status> [artifact-ref...]
```

Use the canonical work ID for task-linked work; use `-` only for genuinely
unlinked work. The helper generates UTC timestamps and appends each JSONL row
with one `O_APPEND` write. Do not retry a successful append, reuse an invocation
ID, or reconstruct a missing terminal fact. If no trustworthy terminal response
exists, leave the dispatch incomplete for later analysis.

Do not store prompts, responses, secrets, quality scores, synthetic difficulty
labels, or inferred runtime facts. The current runtime interface does not
report the model that actually executed, so `requested_model` and
`requested_effort` remain requested values and must not be relabeled as
effective values. Link existing stage reports and handoffs instead of copying
their prose into the log.

An append failure blocks stage closure until the root records the missing
event. It never changes the worker's raw terminal status, weakens workflow
safety, or proves that a report returned.

## Spawn boundary

```text
model choice: <root-selected candidate>
instruction source: skill-backed | persona-backed
canonical skill: <adapter and applicable primitives>  # skill-backed
persona: <exact installed prompt>                      # persona-backed
task input: <bounded target and contract>
```
