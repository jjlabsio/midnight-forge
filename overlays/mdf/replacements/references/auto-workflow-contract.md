# Local Auto Workflow Profile

This reference is the only owner of `auto-workflow` composition. Load
`automatic-operation-contract.md` for the shared root boundary, operation
binding, evidence, DDD recovery, failure recovery, and completion rules.

## Profile

1. Intent preflight.
2. Spec executor, critic, root acceptance.
3. Plan executor, critic, root acceptance.
4. Run the per-slice build loop.
5. Run the whole-build sequence.
6. Write the local handoff.

Authority:

- Allow task-owned local writes and focused commits.
- Keep the task `active` and lock held.
- Omit ship, whole-task completion, push, PR mutation, merge, deploy, deletion,
  force, stale-lock takeover, and unrelated cleanup.

## Per-slice build loop

For every ready plan slice:

1. Root selects one slice.
2. Build executor runs RED, GREEN, regression, and build.
3. Root observes the actual diff and verification.
4. Slice critic reviews against the plan and spec.
5. Rework the same slice until accepted or `BLOCKED`.
6. Root commits exact slice paths.
7. Root records the accepted slice and commit OID in the handoff.
8. Root re-reads plan, card, lock, and Git before selecting another slice.

Do not invoke upstream `build auto`. Do not run code simplification in a slice.

After every approved slice is committed, run the whole-build sequence:

1. Run the plan's whole-build verification matrix.
2. Run one fresh read-only whole-tree critic against the specification and
   root-observed tree.
3. Repair findings through the affected build slice; repeat invalidated checks.
4. Run `code-simplify` once over the complete changed scope.
5. Run the complete applicable test suite and build after simplification.
6. Run a fresh simplification critic over the actual diff and behavior evidence.
7. Commit simplification separately when changed; skip an empty commit.

## Completion

Finish with the verified local handoff or `BLOCKED`. Keep the task `active` and
its lock held.
