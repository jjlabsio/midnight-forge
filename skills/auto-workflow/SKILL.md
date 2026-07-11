---
name: auto-workflow
description: "Use when the user asks MDF to run the approved lifecycle automatically through PR preparation."
---

# auto-workflow

`auto-workflow` is a flat root orchestrator. Resolve the installed plugin root
before every delegated path, and hand each phase canonical artifacts rather
than a paraphrased handoff. It delegates to the actual controllers and their
exact upstream primitives:

```text
spec -> plan -> build all approved plan tasks -> review -> ship -> github-pr
```

The root owns phase state, artifact pointers, approvals, synthesis, and the
one-writer serialization in the shared worktree. Personas and generic subagents are
read-only reporters: they never invoke one another, write shared artifacts, or
advance the lifecycle. Select a model/executor by capability when the runtime
can verify that capability; otherwise use root fallback for quality-critical
work and record the fallback.

## Required stop and progression rules

- Stop after `spec` until explicit spec approval is recorded for its exact
  revision/hash.
- Stop after `plan` until explicit plan approval is recorded for its exact
  revision/hash.
- An artifact revision invalidates prior approval.
- Run every task in the exact approved plan revision, in order, with build's
  task verification, fresh review, downstream-impact, and focused-commit gate.
- Run whole-build verification and review only after all approved plan tasks
  complete; a selected task cannot create completion evidence.
- Preserve upstream clean-baseline, resume, task-only staging, and
  high-risk/irreversible sign-off stops for autonomous work.
- Fix actionable review findings and re-review while progress is material;
  stop for repeats, regressions, no-progress, or a human decision.

The root-only synthesis produces the final decision. `ship` retains the
upstream persona fan-out and `github-pr` retains its own git/PR behavior.

For autonomous task work, first verify matching `approval-NNN.md` records using
`../../references/approval-evidence.md`, then run `git status --porcelain` and
stop on unrelated dirt. Commit any promoted tracked planning artifact before
task work; local `.mdf` evidence is not staged. Before each task, recheck the
baseline, stage only enumerated task files with `git add -- <paths>`, commit one
passed task, and resume from the next canonical pending task after a blocker.

## Controller algorithm

1. Verify MDF user/project initialization and resolve the current canonical
   work item and its latest artifacts. Stop on malformed or conflicting state.
2. Select the first incomplete phase: no approved spec -> `spec`; no approved
   plan -> `plan`; pending approved plan task -> build loop; no passing
   whole-build evidence -> whole-build verification/review; no passing
   standalone review -> `review`; no GO -> `ship`; otherwise `github-pr`.
3. Load the selected controller from the resolved plugin root and follow it;
   do not inline its upstream primitive or rewrite its result.
4. Stop immediately for `question needed`, missing information, a user
   decision, failed verification, stale approval, failed fresh-review gate,
   NO-GO, or a git/PR ambiguity. Do not infer a phase result from an artifact's
   existence alone.
5. Resume only from canonical evidence that satisfies the selected phase's
   approval, verification, and review contract.

## Build-loop runtime

From the resolved plugin root, drive autonomous build state through production
`./scripts/mdf-controller.js whole-build` operations, passing JSON on stdin:

- `resume` with approved `plan_registration_file` and root `writer_id` returns
  a new task, the same writer's canonical in-progress attempt, or the
  `whole-build` action. Never reconstruct progress from counts or prose.
- After all tasks complete, `begin` binds the approved plan metadata's complete
  ordered shell-free command matrix to the exact clean final task commit chain.
- Execute every returned matrix entry through `verify`; do not submit caller
  claimed exit codes.
- Use `inputs` to obtain the exact spec, plan, task-transition, traceability,
  and command evidence paths for a separate fresh upstream code review.
- Call `finalize` with the complete ordered verification set and exact raw
  review decision. Only its stable transition permits simplification.

Any pending/duplicate/unknown task, conflicting writer, partial or reordered
matrix, stale tree/report, failed command, or review mismatch is a typed stop.
