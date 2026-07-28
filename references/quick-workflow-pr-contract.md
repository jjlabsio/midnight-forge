# Quick Workflow PR Profile

This reference is the only owner of `quick-workflow-pr` composition. Load
`<plugin-root>/references/automatic-operation-contract.md` for every shared
operation rule.

Use this profile when the user explicitly selects it. Use the user request and
current task context as the acceptance baseline.

## Sequence

| Current accepted state | Next operation |
| --- | --- |
| Shared preflight is incomplete | Apply the shared root boundary. |
| No accepted build | Dispatch one build executor. |
| Executor returned a successful terminal status with a complete reviewable report | Observe the actual diff and checks, then dispatch one fresh critic. Every other terminal response follows the shared evidence and recovery rules instead. |
| Critic returned a successful terminal status with a complete `pass` or `changes_requested` report | Root dispositions every actionable finding through the shared completion standard. Rework only `fix-now`, stop for `needs-user`, and permit acceptance when no current-delivery blocker remains. |
| Root accepts the observed change | Commit only the accepted result. |
| Accepted commit is local only | Invoke `github-pr`. |
| PR exists at the latest head | Verify remote OID, latest-head checks, mergeability, and conflicts. |
| PR is verified | Store the immutable task-card PR link when absent and finish this profile. |

The build is the planless port of upstream build. Retain every applicable RED,
GREEN, regression, and build step; keep review and commit in the root.

## Omissions

Do not run spec, plan, simplification, ship, separate whole-build verification,
or separate whole-tree review. Create no empty gates.

## Authority and completion

- The selected profile grants the root every action required by the accepted
  outcome and criteria. This profile defines the direct PR delivery sequence;
  it is not an action allowlist.
- Finish with the verified PR link or `BLOCKED`.
- Keep the task `active` and its lock held.

Only a later explicit, separate `github-after-merge` invocation owns task
finalization. That lifecycle division does not restrict actions required by the
accepted outcome and criteria.
