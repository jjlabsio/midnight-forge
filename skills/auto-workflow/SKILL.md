---
name: auto-workflow
description: "Run MDF's local implementation workflow through review, simplification, and commit without ship or PR delivery."
---

# auto-workflow

Use this skill for the repeatable local implementation loop. It is intentionally
separate from `auto-workflow-pr`: this skill does not authorize ship, task
completion, push, or PR creation/update.

Load the plugin-installed `../../references/auto-workflow-contract.md` and use
`mode: auto-workflow` for downstream MDF skills. The contract is the single
source of truth for the shared auto-mode middle stages; this entrypoint only
defines the local authority boundary below.

## Local lifecycle boundary

Follow the shared auto-mode middle-stage lifecycle in the loaded contract.
This local entrypoint continues through every approved plan slice, the
whole-build verification/review, and the final local handoff. A plan task is an
implementation slice, not the whole MDF task. Keep the active task ownership
and lock for a later continuation; do not mark the whole MDF task `done` or
release its lock here. If whole-build, final review, or another local consumer
fails, record the evidence and use the shared earliest-invalidated-stage
recovery protocol on the same task and lock.

## Stop boundary

After all approved plan slices, whole-build verification/review, and the
readable local handoff are complete, stop. Do not stop after the first slice's
commit merely because its local build and review passed. This skill must not:

- invoke `ship`;
- mark the whole MDF task `done`;
- push a branch;
- create or update a GitHub PR;
- merge, deploy, delete, force, or perform unrelated cleanup.

When the user is ready for delivery, invoke `auto-workflow-pr`. That skill may
resume from the latest valid local artifacts and commits rather than repeating
completed implementation work.

## Required handoff

Use the shared contract's handoff fields and additionally record the explicit
fact that ship, task completion, push, and PR creation/update were not
performed. Re-read the actual task, Git, lock, and artifact state before any
continuation.
