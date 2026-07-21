---
name: auto-workflow
description: "Run MDF's local implementation workflow through review and commit without delivery."
---

# auto-workflow

Use this skill for one unattended local implementation run. It does not
authorize ship, whole-task completion, or PR delivery.

Resolve the installed plugin root. Load and run the exact upstream
`../using-agent-skills/SKILL.md` discovery workflow, resolve this canonical
entrypoint, and load every other applicable upstream primitive it selects.
Then load `../../references/auto-workflow-contract.md` and use
`mode: auto-workflow` plus the current readable handoff for every canonical
stage invocation. An unresolved plugin root, bare mode string, or missing
handoff is a final `BLOCKED` result.

## Root preflight

1. Apply the contract's shared startup resolution and intent preflight in the
   root context. Re-read the exact task card, lock, handoff, spec/plan
   revisions, worktree, branch, base, `HEAD`, index, tree, diff, and authority.
2. Reuse only current matching state. Do not create replacement task, lock,
   worktree, branch, artifact, or evidence state to guess a continuation.
3. Keep intent, authority, stage selection, artifact acceptance, canonical
   `.mdf` state, commits, lifecycle, and final synthesis root-only.

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
4. After all approved slices commit, apply the plan's whole-build verification
   as a separate Two-Key stage, invoking canonical `test` when applicable, then
   invoke canonical `review` against the complete approved tree for a separate
   Two-Key `PASS`.
5. Write the current local handoff and stop with the task active and lock held.

A repair re-enters the earliest invalidated canonical adapter under the same
handoff. A changed implementation or simplification result invalidates affected
verification, staging, and review evidence; restage only after the required
gates are current.

## Local authority and stop

The root alone creates each focused slice commit after review `PASS`. This mode
omits ship, whole-task completion, push, PR mutation, and PR consumer checks;
it must not create empty gates for them. Merge, deploy, deletion, force,
stale-lock takeover, and unrelated cleanup are prohibited.

Run without intermediate prompts inside settled authority. Missing, incomplete,
non-fresh, non-terminal, or under-capability keys; changed or stale state;
unrelated dirt; scope or lease violation; uncertain writer terminality;
verification failure without a safe in-scope cycle; ambiguity requiring new
authority; or three exhausted cycles must preserve actual state and finish
`BLOCKED`. Never silently fall back, roll back, or report terminal `REWORK`.

Record the shared handoff fields and that ship, whole-task completion, push, PR
mutation, and PR consumer checks were omitted.
