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
stage invocation.

## Contract execution

Apply the contract's shared startup task/worktree resolution in the root, then
follow its entire shared middle lifecycle, resume and artifact-validity rules,
consumer recovery, and success-or-`BLOCKED` terminal semantics by reference.
The root retains every ownership boundary assigned by the contract.

## Local outcome

The root alone creates each focused slice commit after review `PASS`. This mode
omits ship, whole-task completion, push, PR mutation, and PR consumer checks;
it must not create empty gates for them. Merge, deploy, deletion, force,
stale-lock takeover, and unrelated cleanup are prohibited.

Finish by writing the contract-defined current local handoff, recording those
omissions, and reporting verified local success or the contract's final
`BLOCKED` outcome. Keep the task active and its lock held for continuation.
