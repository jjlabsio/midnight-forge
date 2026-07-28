# Auto Workflow PR Profile

This reference is the only owner of `auto-workflow-pr` composition. Load
`<plugin-root>/references/automatic-operation-contract.md` for shared operation
rules and `<plugin-root>/references/auto-workflow-contract.md` for the local
workflow this profile runs or resumes.

## Sequence

| Current accepted state | Next operation |
| --- | --- |
| Local workflow is incomplete | Run or resume `auto-workflow`. |
| Local result is accepted | Invoke canonical `ship` directly from the root with the bound whole-build verification evidence. |
| `ship` returned GO | Run a fresh preflight, then invoke `github-pr`. |
| PR exists at the latest head | Verify remote OID, latest-head checks, mergeability, and conflicts. |
| PR is verified | Store the immutable task-card PR link when absent and finish this profile. |

Canonical `ship` uses the exact upstream three-specialist parallel fan-out and
root merge. Its specialists inspect the existing bound evidence and identify
gaps; they do not rerun an identical valid suite. Add no outer ship executor,
critic, verifier, or coordinator.

## Authority and completion

- The selected profile grants the root every action required by the accepted
  outcome and criteria. This profile defines PR delivery and task-state
  completion; it is not an action allowlist.
- Finish with the verified PR link or `BLOCKED`.
- Keep the task `active` and its lock held.

Only a later explicit, separate `github-after-merge` invocation verifies the
merged PR's final state through the task-card PR link, completes the task,
releases the lock, and performs its cleanup contract. That lifecycle division
does not restrict actions required by the accepted outcome and criteria.
