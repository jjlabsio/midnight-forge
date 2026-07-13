---
name: build
description: "Use when implementing an approved MDF plan with TDD, focused verification, review, and task-owned commits."
---

# build

Build is a model-led implementation workflow. Resolve the installed plugin
root before loading any skill or reference; an unresolved plugin root is a
stop. Load and follow the exact
upstream `../incremental-implementation/SKILL.md`,
`../test-driven-development/SKILL.md`, and
`../code-review-and-quality/SKILL.md`; add UI, API, security, documentation,
debugging, or other applicable skills when their triggers apply.

## Task loop

1. Resolve the canonical root, read the exact approved specification and plan
   revisions, and confirm their paths and SHA-256 values are still current.
2. Read the task card and current index projection. Choose exactly one
   selected or next pending task that is ready, confirm its owned paths, and
   acquire the task lock using the approved
   lock procedure. Do not infer readiness from card text that conflicts with
   canonical state, a live lock, or the plan.
3. Confirm the worktree is the locked worktree, the expected branch is checked
   out, and the baseline is clean. Stop for unrelated dirt, lock conflict,
   ambiguous ownership, or a missing setup.
4. Follow upstream TDD: write a failing test or reproducible check when the
   behavior warrants one, make the smallest implementation, and run focused
   verification. Keep edits inside the task-owned paths.
5. Review the diff and verification results against the full specification,
   plan, task acceptance, and relevant project documentation. Write readable
   Markdown notes in the work item when the task's reasoning or downstream
   impact needs to be preserved. Aim for a fresh-context upstream code review
   when an independent reviewer is available; if it is unavailable, perform
   and disclose a root review rather than claiming independent freshness.
6. Apply a downstream-impact gate in ordinary language. Actionable findings,
   verification regressions, ambiguity, or a scope change must be fixed,
   replanned, or stopped before commit. Do not let a clean command substitute
   for semantic correctness.
7. Stage only the exact task-owned paths and create one focused commit. Release
   the lock only through the task skill's owner and digest checks after the
   task handoff is complete. Never stage unrelated work.
8. Re-read the card and index projection and report the commit, verification,
   remaining tasks, and any explicit follow-up decision.

## Failure and recovery

On a failed check, preserve the failure, reproduce it, and load the exact
upstream `../debugging-and-error-recovery/SKILL.md`. A bounded, reversible,
task-owned repair that preserves intent may continue after the normal review
and verification loop. A non-reproducible failure, user-goal change, external
effect, material trade-off, repeated no-progress failure, or destructive
operation stops for human judgment. Technical revisions return to `spec` and
must not reuse stale plan or review conclusions.

## Automatic continuation and completion

`build auto` and `build all` are this same loop repeated over all approved plan
tasks. Before each task, recheck approval, lock ownership, clean baseline, and
exact task scope; inspect `git status --porcelain`, stage with `git add --`,
create one commit per task, and resume at the next pending task. After all
approved plan tasks pass, run the whole-build verification matrix from the
plan and perform a final review against the full specification. Report
completion only after that review with a readable task handoff that identifies
the commit, checks, and remaining work.
