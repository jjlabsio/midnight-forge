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
| PR is verified and delivery is `pr` | Store the immutable task-card PR link when absent and finish with verified PR delivery. |
| PR is verified and delivery is `merge` | Store the immutable task-card PR link when absent, then execute the merge endpoint. |

The build is the planless port of upstream build. Retain every applicable RED,
GREEN, regression, and build step; keep review and commit in the root.

## Omissions

Do not run spec, plan, simplification, ship, separate whole-build verification,
or separate whole-tree review. Create no empty gates.

## Delivery endpoints and authority

- The selected profile grants the root every action required by the accepted
  outcome and criteria. This profile defines the direct PR delivery sequence;
  it is not an action allowlist.
- The normalized task intent selects `pr` by default. Only this profile
  consumes `merge`; delivery intent does not select this profile or grant
  authority.
- For `pr`, finish with the verified PR link or `BLOCKED` and keep the task
  `active`; execution facts remain in `task.json`.
- For `merge`, immediately after the existing verified-PR gate, freshly query
  and require the exact current PR head and base, every required check (or,
  when GitHub explicitly reports none, every related check), mergeability,
  absence of conflicts, and current GitHub/repository policy. Stop on a
  changed target, pending or failed check, conflict, non-mergeable state,
  policy failure, provider uncertainty, or any other substantive stop.
- Only when that fresh gate passes, perform one normal GitHub merge using a
  method permitted by current repository policy. Never enable auto-merge or
  bypass branch protection, approvals, merge queues, or any GitHub policy.
  On confirmed success, request deletion of the remote head branch, then invoke
  `github-after-merge` for its existing merged-PR verification, finalization,
  and cleanup. A failed merge stops with evidence. A failed remote-branch
  deletion request does not permit a workaround around policy: still invoke
  the finalizer so it can report its documented partial cleanup result.

For `pr`, only a later explicit, separate `github-after-merge` invocation owns
task finalization. For `merge`, this profile invokes that existing finalizer
only after a confirmed normal merge; it does not create another lifecycle path.
