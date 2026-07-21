---
name: auto-workflow-pr
description: "Run MDF's complete implementation, assessment, commit, and GitHub PR workflow."
---

# auto-workflow-pr

Use this skill for one unattended implementation and PR-delivery run. It may
resume valid local `auto-workflow` evidence without repeating completed work.

Resolve the installed plugin root. Load and run the exact upstream
`../using-agent-skills/SKILL.md` discovery workflow, resolve this canonical
entrypoint, and load every other applicable upstream primitive it selects.
Then load `../../references/auto-workflow-contract.md` and use
`mode: auto-workflow-pr` plus the current readable handoff for every canonical
stage invocation. An unresolved plugin root, bare mode string, or missing
handoff is a final `BLOCKED` result.

## Root preflight

1. Apply the contract's shared startup resolution and intent preflight in the
   root context. Re-read the exact task card, lock, handoff, spec/plan
   revisions, completed slices, worktree, branch, base, `HEAD`, index, tree,
   diff, remote facts, and authority.
2. Reuse only current matching artifacts, commits, and evidence. Keep the task
   active and lock held through latest-head consumer checks.
3. Keep intent, authority, stage selection, artifact acceptance, canonical
   `.mdf` state, commits, lifecycle, external mutations, and final synthesis
   root-only.

## Composition

Follow the shared contract's stage order and recovery rules; do not reproduce
their workflows here:

1. Invoke canonical `spec` and `plan` with the current mode and handoff when
   either artifact must be created or revised. Each must return Two-Key
   `PASS` before downstream use.
2. For every ready approved slice, invoke canonical `build` in default
   single-task mode for Two-Key `PASS`, then canonical `code-simplify` for
   Two-Key `PASS` when applicable or record its explicit not-applicable result.
3. Only then may the root stage the exact slice-owned review-candidate paths.
   Invoke canonical `review` on that staged slice for Two-Key `PASS`, then let
   the root invoke `github-commit`. Do not select another slice or commit before
   review passes.
4. After all approved slices commit, ensure the plan's separate Two-Key
   whole-build verification and whole-tree `review` gates are current. Reuse
   evidence already bound to the unchanged target, hashes, and canonical/Git
   state; rerun only a gate whose evidence is missing, stale, changed,
   mismatched, or invalidated, invoking canonical `test` when applicable.
5. Invoke canonical `ship` with the current mode and handoff. Require its exact
   automatic-mode Two-Key `PASS`, including the complete upstream specialist
   fan-out primary key or its exact upstream small-change exception, before
   delivery preflight.
6. With an unchanged accepted target, let the root invoke canonical
   `github-pr` for push, PR create/update, expected remote-HEAD validation, and
   latest-head consumer checks. Only after every check is terminal and passing,
   the PR is mergeable, and no conflict or repair remains may the root invoke
   canonical `task` to mark the whole task done and release the lock.

If no approved slice remains, skip invented implementation work. Reuse current
bound Two-Key whole-build and whole-tree review evidence when its target,
spec/plan hashes, and canonical/Git state are unchanged; rerun only missing,
stale, changed, mismatched, or invalidated gates, then continue to ship. A
failure re-enters the earliest invalidated canonical adapter on the same task,
worktree, branch, and lock. Any resulting source change must repeat only the
build, simplification, staging, review, commit, whole-build, whole-tree, ship,
and delivery gates that it invalidates.

## Authority and stop

Commits, task completion, push, PR mutation, and PR consumer checks are
root-only. Ship assessment is model-led Two-Key. This mode does not authorize
merge, deploy, deletion, force, stale-lock takeover, branch/worktree cleanup,
or unrelated changes.

Run without intermediate prompts inside settled authority. Missing, incomplete,
non-fresh, non-terminal, or under-capability keys; changed or stale state;
unrelated dirt; scope or lease violation; uncertain writer terminality;
ship NO-GO; failed or ambiguous verification, push, PR, or consumer state;
missing external authority; ambiguity requiring new authority; or three
exhausted cycles must preserve actual state and finish `BLOCKED`. Never silently
fall back, roll back, create a duplicate PR, or report terminal `REWORK`.

Record the shared handoff, actual PR URL or terminal failure, latest-head
consumer evidence, and final task/lock state. Stop without merge or cleanup.
