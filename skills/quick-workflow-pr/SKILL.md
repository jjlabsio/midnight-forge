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
`mode: quick-workflow-pr` only as this entrypoint's provenance and composition
selector. Do not forward it as downstream authority.

## Contract execution

In the root, apply the contract's bounded quick-handoff preflight and follow
its complete quick lifecycle, artifact-validity, recovery, PR idempotency, and
success-or-`BLOCKED` terminal semantics by reference. The shared quick
lifecycle requires Two-Key build and bounded-change review; the root retains
the contract's staging, commit, delivery, lifecycle, and synthesis boundaries.
Before every selected stage, the root observes current state and creates the
contract's normalized stage context. Canonical consumers receive the bounded
acceptance baseline and verification profile through that context instead of
interpreting quick mode themselves.

Specification, planning, simplification, ship, separate whole-build
verification, and separate whole-tree review are omitted. The bounded build
and bounded-change review own the applicable verification and review gates;
do not create empty gates for omitted operations.

From current accepted local evidence, the root invokes canonical `github-pr`
for the latest-head consumer and mergeability gates. Only after they pass may
the root complete the whole task and release its lock; otherwise the contract's
recovery and final outcome apply on the same task.

## Authority and stop

Commit, whole-task completion, push, PR mutation, and PR consumer checks are
root-only. Merge, deploy, deletion, force, stale-lock takeover,
branch/worktree cleanup, and unrelated changes are prohibited.

Record the bounded request, omitted stages, resolved skills, verification and
review evidence, commit, actual PR result, latest-head consumer evidence, and
final task/lock state. Finish with verified success or the contract's final
`BLOCKED` outcome, without duplicate PR creation, merge, or cleanup.
