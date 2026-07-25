# Auto Workflow PR Profile

This reference is the only owner of `auto-workflow-pr` composition. Load
`<plugin-root>/references/automatic-operation-contract.md` for shared operation
rules and `<plugin-root>/references/auto-workflow-contract.md` for the local
workflow this profile runs or resumes.

## Sequence

| Current accepted state | Next operation |
| --- | --- |
| Local workflow is incomplete | Run or resume `auto-workflow`. |
| Local result is accepted | Invoke canonical `ship` directly from the root. |
| `ship` returned GO | Run a fresh preflight, then invoke `github-pr`. |
| PR exists at the latest head | Verify remote OID, latest-head checks, mergeability, and conflicts. |
| PR is verified | Store the immutable task-card PR link when absent and finish this profile. |

Canonical `ship` uses the exact upstream three-specialist parallel fan-out and
root merge. Add no outer ship executor, critic, verifier, or coordinator.

## Authority and completion

- After fresh preflight, allow root-owned push and matching PR create or update.
- Finish with the verified PR link or `BLOCKED`.
- Keep the task `active` and its lock held.
- Do not wait for, monitor, or perform the merge.
- Do not deploy, delete, force, take over a stale lock, or clean unrelated
  state.

Post-merge work is outside this profile. Only a later explicit, separate
`github-after-merge` invocation verifies the accepted revision, completes the
task, releases the lock, and performs its cleanup contract.
