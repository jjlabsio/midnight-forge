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
stage invocation.

## Contract execution

Apply the contract's shared startup task/worktree resolution in the root. Reuse
only evidence accepted as current by its resume and artifact-validity rules,
then follow its entire shared middle lifecycle, recovery protocol, and
success-or-`BLOCKED` terminal semantics by reference. If no current slice
remains, do not invent implementation work.

## Delivery continuation

From current accepted local evidence, the root invokes the canonical `ship`
fan-out directly in this mode; do not dispatch a generic skill-backed `ship`
worker that delegates to the specialist personas. After its required result,
keep the task active and lock held while the root
invokes canonical `github-pr` under the contract's PR idempotency rules and
verifies the expected remote head, latest-head checks, mergeability, and
conflict state. Only after every consumer gate passes may the root invoke
canonical `task` to complete the whole task and release the lock. Any failure
uses the shared recovery protocol on the same task, worktree, branch, and lock.

## Authority and stop

Commits, task completion, push, PR mutation, and PR consumer checks are
root-only. Ship assessment is model-led Two-Key. This mode does not authorize
merge, deploy, deletion, force, stale-lock takeover, branch/worktree cleanup,
or unrelated changes.

Record the shared handoff, actual PR URL or terminal failure, latest-head
consumer evidence, and final task/lock state. Finish with the contract's
verified success or final `BLOCKED` outcome, without duplicate PR creation,
merge, or cleanup.
