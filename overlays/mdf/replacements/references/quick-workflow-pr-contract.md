# Quick Workflow PR Profile

This reference is the only owner of `quick-workflow-pr` composition. Load
`<plugin-root>/references/automatic-operation-contract.md` for every shared
operation rule.

Use this profile only when the user explicitly selects the bounded
small-change workflow. Use the user request and current task context as the
acceptance baseline.

## Sequence

| Current accepted state | Next operation |
| --- | --- |
| Scope or authority is unverified | Validate both. |
| No accepted bounded build | Dispatch one bounded build executor. |
| Executor returned a successful terminal status with a complete reviewable report | Observe the actual diff and checks, then dispatch one fresh bounded-change critic. Every other terminal response follows the shared evidence and recovery rules instead. |
| Critic returned `changes_requested`, including any actionable finding | Rework the same bounded target through the shared operation sequence and dispatch a fresh critic. |
| Fresh critic returned `pass` | Root decides acceptance and commits only the accepted result. |
| Accepted commit is local only | Invoke `github-pr`. |
| PR exists at the accepted head | Verify remote OID, latest-head checks, mergeability, and conflicts. |
| Delivery is verified | Write the delivery handoff and finish this profile. |

The bounded build is the planless port of upstream build. Retain every
applicable RED, GREEN, regression, and build step; keep review and commit in the
root.

## Omissions

Do not run spec, plan, simplification, ship, separate whole-build verification,
or separate whole-tree review. Create no empty gates.

## Authority and completion

- Finish with the verified delivery handoff or `BLOCKED`.
- Keep the task `active` and its lock held.
- Do not wait for, monitor, or perform the merge.
- Do not deploy, delete, force, take over a stale lock, or clean unrelated
  state.

Post-merge work is outside this profile. Only a later explicit, separate
`github-after-merge` invocation owns finalization.
