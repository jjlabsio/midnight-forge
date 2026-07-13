---
name: auto-workflow
description: "Use when the user asks MDF to run the approved workflow automatically through PR preparation."
---

# auto-workflow

`auto-workflow` is a flat root orchestrator implemented as a model-led
sequence over the exact upstream skills. Resolve the installed plugin root
before loading any skill or reference:

```text
spec -> plan -> build all approved plan tasks -> whole-build review -> simplify -> ship -> github-pr
```

The root agent owns root-only synthesis, readable Markdown notes, one-writer worktree
coordination, and user-facing stops. Each skill owns its own checklist and
does not invoke a hidden phase machine. Resolve the canonical root and current
task card before reading artifacts or changing the worktree.

## Required stops and progression

- Stop after `spec` until explicit spec approval covers the exact saved
  specification revision and SHA-256.
- Stop after `plan` until explicit plan approval covers the exact saved plan
  revision and SHA-256.
- A byte, path, scope, or task-order change invalidates earlier approval.
- Build every task in the approved order, using TDD, task-owned paths, focused
  verification, review, downstream-impact judgment, and one focused commit.
- Run whole-build verification and final review only after all approved plan
  tasks complete.
- Preserve clean-baseline, resume, task-only staging, and high-risk or
  irreversible sign-off stops.
- If simplification changes the tree, rerun the whole-build matrix and final
  review. If it makes no accepted change, record that fact against the same
  unchanged tree and do not run a duplicate standalone review.
- Fix actionable findings and review again while progress is material; stop for
  repeats, regressions, no progress, ambiguity, or a user decision.
- Never infer a phase result from an artifact's existence or a green command
  alone.

## Automatic loop

1. Verify MDF initialization, resolve the canonical work item, and read the
   latest valid card/index state. Stop on malformed or conflicting state.
2. Select the first incomplete step from the sequence above: definition,
   planning, an approved pending task, whole-build verification/review,
   simplification, ship, or PR preparation.
3. Load the exact selected upstream skill and follow it completely. Keep
   semantic routing, task readiness, downstream impact, and recovery judgment
   with the model.
4. Before every task, inspect the clean Git baseline, lock ownership, branch,
   worktree, exact owned paths, and current approvals. Stage only enumerated
   task paths with `git add -- <paths>` and resume at the next pending task
   after a resolved blocker.
5. Stop for a question, missing information, failed verification, stale
   approval, unresolved review finding, NO-GO, or Git/PR ambiguity. Explain the
   exact decision needed; do not retry blindly.

## Recovery

Preserve a failed check or review in a readable work-item note and reproduce
it before changing code. Load the exact upstream debugging and recovery skill.
Do not reopen a completed task; a bounded, reversible, intent-preserving task
repair returns through the ordinary task workflow and, when planning changes,
uses a new canonical plan revision. A product, public-contract, architecture,
scope, material-trade-off, external, destructive, or ambiguous issue returns
to the user. There is no fixed repair-count limit, but repeated no-progress or
unexplained regression stops the workflow. Never reuse stale conclusions.

After all tasks pass, run the plan's complete whole-build matrix, perform a
fresh final review against the full specification, and hand off to
`code-simplify`, `ship`, and `github-pr` in order. Each external mutation
requires its own current user confirmation.
