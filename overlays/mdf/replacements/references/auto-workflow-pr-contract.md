# Auto Workflow PR Profile

This reference is the only owner of `auto-workflow-pr` composition. Load
`automatic-operation-contract.md` for shared operation rules and
`auto-workflow-contract.md` for the accepted local workflow it runs or resumes.

## Profile

1. Run or resume `auto-workflow` through its accepted local result.
2. Invoke canonical `ship` from the root.
3. Invoke `github-pr` after GO and fresh preflight.
4. Verify remote OID, latest-head checks, mergeability, and conflicts.
5. Write the delivery handoff; keep task `active` and lock held.
6. Finish with verified PR delivery. Do not wait for or monitor the merge.

Post-merge work is outside this profile. A later explicit, separate
`github-after-merge` invocation verifies the accepted revision, completes the
task, releases the lock, and performs its cleanup contract.

Canonical `ship` uses the exact upstream three-specialist parallel fan-out and
root merge. Do not add an outer ship executor, critic, verifier, or coordinator.

## Authority

- Allow root-owned push and matching PR create/update after fresh preflight.
- Omit merge, deploy, deletion, force, stale-lock takeover, and unrelated
  cleanup inside this profile.

## Completion

Finish with the verified delivery handoff or `BLOCKED`. Leave the task `active`
and its lock held for the separate `github-after-merge` invocation.
