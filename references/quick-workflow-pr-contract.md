# Quick Workflow PR Profile

This reference is the only owner of `quick-workflow-pr` composition. Load
`automatic-operation-contract.md` for shared root, operation, evidence, DDD,
recovery, and completion rules.

Use only when the user explicitly selects the bounded small-change workflow.

## Profile

1. Validate scope and authority.
2. Run one bounded build executor.
3. Observe the actual diff and checks.
4. Run one fresh bounded-change critic.
5. Rework through the shared operation binding until a fresh critic returns
   `pass`; the root alone decides acceptance and commits only an accepted
   result.
6. Invoke `github-pr`; verify remote OID, latest-head checks, mergeability, and
   conflicts.
7. Write the delivery handoff; keep task `active` and lock held.
8. Finish with verified PR delivery. Do not wait for or monitor the merge.

Post-merge work is outside this profile. A later explicit, separate
`github-after-merge` invocation owns finalization.

Use the user request and current task context as the acceptance baseline. The
bounded build is the planless port of upstream build: retain applicable RED,
GREEN, regression, and build steps; keep review and commit in the root.

## Omissions

Omit spec, plan, simplification, ship, separate whole-build verification, and
separate whole-tree review. Create no empty gates. Omit merge, deploy, deletion,
force, stale-lock takeover, and unrelated cleanup inside this profile.

## Completion

Finish with the verified delivery handoff or `BLOCKED`. Leave the task `active`
and its lock held for the separate `github-after-merge` invocation.
