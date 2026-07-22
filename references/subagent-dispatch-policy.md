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
6. Record the selected model, instruction source, task kind, risk, capability
   confidence, write scope, fallback, and degraded status in a readable note.

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

## Minimal observation

For each generic dispatch, the root may append a dispatch and terminal record
to `<canonical-root>/.mdf/observations/subagent-invocations.jsonl`:

```json
{"event":"dispatch","invocation_id":"<id>","requested_model":"<model>","work_id":null,"status":"dispatched","dispatched_at":"<UTC>"}
{"event":"terminal","invocation_id":"<id>","status":"completed|failed|timed_out|interrupted","completed_at":"<UTC>","artifact_refs":[]}
```

Keep paths project-relative. Do not store prompts, responses, secrets, quality
scores, or inferred runtime facts. Observation failure never weakens workflow
safety and an observation is never proof that a report returned.

## Spawn boundary

```text
model choice: <root-selected candidate>
instruction source: skill-backed | persona-backed
canonical skill: <adapter and applicable primitives>  # skill-backed
persona: <exact installed prompt>                      # persona-backed
task input: <bounded target and contract>
```
