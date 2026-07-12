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
spec -> plan -> build all approved plan tasks -> whole-build review -> simplify -> ship -> github-pr
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
- The two human approval stops apply to the initial definition generation. A
  provenance-bound, intent-preserving technical revision automatically
  advances only its newly reviewed spec and plan; product/scope/trade-off
  changes still stop.
- An artifact revision invalidates prior approval.
- Run every task in the exact approved plan revision, in order, with build's
  task verification, fresh review, downstream-impact, and focused-commit gate.
- Run whole-build verification and review only after all approved plan tasks
  complete; a selected task cannot create completion evidence.
- Preserve upstream clean-baseline, resume, task-only staging, and
  high-risk/irreversible sign-off stops for autonomous work.
- If simplification changes the tree, return through whole-build verification
  and a fresh whole-build review. If it makes no accepted change, reuse the
  passing whole-build review bound to that exact unchanged tree; do not run a
  duplicate standalone review.
- Fix actionable review findings and re-review while progress is material;
  stop for repeats, regressions, no-progress, or a human decision.
- After a typed stop, preserve the append-only evidence. If the user resolves
  the stop, call `mdf-controller lifecycle resume` with the current stop event
  and the user-decision artifact; resume returns to the same phase and does not
  bypass that phase's ordinary gate. There is no blind retry for stale or
  malformed state.

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
   whole-build evidence -> whole-build verification/review; no completed
   simplification decision for that stable tree -> `code-simplify`; no GO ->
   `ship`; otherwise `github-pr`. The independently invoked `review` controller
   remains available, but auto-workflow does not duplicate the exact final-tree
   whole-build review.
3. Load the selected controller from the resolved plugin root and follow it;
   do not inline its upstream primitive or rewrite its result.
4. Stop immediately for `question needed`, missing information, a user
   decision, failed verification, stale approval, failed fresh-review gate,
   NO-GO, or a git/PR ambiguity. Do not infer a phase result from an artifact's
   existence alone.
5. When a user decision resolves a resumable stop, call
   `mdf-controller lifecycle resume` with its exact stop event and user-message
   artifact. The runtime appends a decision-bound resume event and returns the
   same phase; continue only through that phase's normal controller.
6. Resume only from canonical evidence that satisfies the selected phase's
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

## Whole-build recovery loop

Do not reopen a completed task or repair directly from its old plan text. On a
whole-build command failure or an actionable whole-build-review finding:

1. Preserve the exact baseline, failure/finding, and reproduction or validation
   evidence. Validate a review finding against the approved spec before treating
   it as a defect; optional clarity/style suggestions wait for simplification.
2. Run fresh-context diagnosis, then have the root orchestrator synthesize the
   evidence and classify it as implementation, plan, spec, environment, or
   ambiguous. The root may resolve reviewer disagreement when the evidence is
   clear, but records the rejected view and rationale; otherwise stop.
   Submit those exact artifacts through `mdf-controller.js recovery whole-build`.
3. For an implementation defect or intent-preserving technical plan defect,
   create a new canonical plan revision that preserves completed tasks and
   appends stable repair task IDs. Split independently verifiable scopes; never
   create one catch-all repair task. A product, public-contract, architecture,
   material-trade-off, unclear, external, or high-risk decision stops for the
   user. Freshly review the exact appended plan and register it through
   `mdf-controller.js recovery plan`.
4. Execute each repair task through the ordinary task workflow without a
   shortcut: TDD for behavioral code (or the normal documented exception),
   verification, acceptance, downstream impact, fresh task review, finding
   repair loop, and one focused commit.
5. Rerun the complete whole-build matrix and fresh whole-build review from the
   start. A production-code repair invalidates prior simplification and scans the
   new stable tree again; documentation/config-only repair may reuse
   simplification only when production scope is proven identical.

There is no fixed repair-count limit. Continue only when the root records
material progress, a distinct evidence-backed root cause, unchanged approved
scope, and no unexplained regression or scope expansion. The same substantive
failure/finding, worsening verification, or absent material progress is a
`no-progress` stop even if wording or surface symptoms differ.
