---
name: quick-workflow-pr
description: "Run a bounded lightweight build, review, commit, and GitHub PR workflow."
---

# quick-workflow-pr

Use this skill only when the user has explicitly selected the small-change
workflow. It is not an automatic complexity classifier.

Resolve the installed plugin root. Load and run the exact upstream
`../using-agent-skills/SKILL.md` discovery workflow, resolve this canonical
entrypoint, and load every other applicable upstream primitive it selects.
Then load `../../references/auto-workflow-contract.md` and use
`mode: quick-workflow-pr` plus the current readable quick handoff for every
canonical stage invocation. An unresolved plugin root, bare mode string, or
missing handoff is a final `BLOCKED` result.

## Root preflight

1. In the root context, bind the user's settled request, active task Context,
   task/work IDs, matching lock, worktree, branch, base, `HEAD`, exact intended
   paths, verification requirements, allowed actions, and quick handoff.
2. Re-read current canonical and Git state before every continuation. Stop on
   missing, ambiguous, conflicting, or expanded scope; do not create a spec,
   plan, replacement state, or broader authority.
3. Keep intent, authority, stage selection, canonical `.mdf` state, commits,
   lifecycle, external mutations, and final synthesis root-only.

## Composition

Follow the shared contract and canonical adapters; do not reproduce their
workflows here:

```text
canonical build Two-Key PASS
  -> root exact-path review-candidate staging
  -> canonical review Two-Key PASS
  -> root github-commit
  -> root github-pr and latest-head consumer checks
  -> root task completion and lock release
```

1. Invoke canonical `build` with the current mode and handoff for the single
   bounded change. Require Two-Key `PASS` on its actual diff and bound
   verification evidence.
2. Let the root stage only the exact bounded-change review-candidate paths,
   then invoke canonical `review` with `review_mode: task-review` against that
   staged diff. Require Two-Key `PASS` before the root invokes `github-commit`.
3. Let the root invoke canonical `github-pr` for push, PR create/update,
   expected remote-HEAD validation, and latest-head consumer checks. Only after
   every check is terminal and passing, the PR is mergeable, and no conflict
   or repair remains may the root invoke canonical `task` to mark the work done
   and release the lock.
4. Route an actionable finding or consumer defect through canonical `build`,
   root exact-path staging, canonical `review`, and root `github-commit` on the
   same task before repeating invalidated delivery checks.

Specification, planning, simplification, ship, separate whole-build
verification, and separate whole-tree review are omitted. The bounded build
and bounded-change review own the applicable verification and review gates;
do not create empty gates for omitted operations.

## Authority and stop

Commit, whole-task completion, push, PR mutation, and PR consumer checks are
root-only. Merge, deploy, deletion, force, stale-lock takeover,
branch/worktree cleanup, and unrelated changes are prohibited.

Run without intermediate prompts inside settled authority. Missing, incomplete,
non-fresh, non-terminal, or under-capability keys; changed or stale state;
unrelated dirt; scope or lease violation; uncertain writer terminality;
failed verification; unresolved review findings; failed or ambiguous push, PR,
or consumer state; missing external authority; ambiguity requiring spec/plan or
other new authority; or three exhausted cycles must preserve actual state and
finish `BLOCKED`. Never silently fall back, roll back, create a duplicate PR,
or report terminal `REWORK`.

Record the bounded request, omitted stages, resolved skills, verification and
review evidence, commit, actual PR result, latest-head consumer evidence, and
final task/lock state. Stop without merge or cleanup.
