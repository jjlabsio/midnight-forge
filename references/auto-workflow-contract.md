# Local Auto Workflow Profile

This reference owns `auto-workflow` composition. Load
`automatic-operation-contract.md` for every shared operation rule.

## Sequence

| Current accepted state | Next operation |
| --- | --- |
| Intent is insufficient | Apply the shared intent preflight. |
| Intent is sufficient; no accepted spec | Run spec executor, critic, and root acceptance. |
| Spec is accepted; no accepted plan | Run plan executor, critic, and root acceptance. |
| A ready plan slice remains | Run the per-slice loop. |
| Every slice is accepted and committed | Run whole-build verification and simplification. |
| Whole build is accepted | Write the verified local handoff. |

## Per-slice loop

For each ready plan slice:

1. Root selects one slice.
2. Build executor runs RED, GREEN, regression, and build.
3. Root observes the actual diff and verification.
4. Slice critic reviews against the plan and specification.
5. Rework the same slice until accepted or `BLOCKED`.
6. Root commits exactly the slice-owned paths.
7. Root records the accepted slice and commit OID in the handoff.
8. Root re-reads plan, card, lock, and Git before selecting another slice.

Do not invoke upstream `build auto`. Do not simplify an individual slice.

## Whole-build sequence

After every approved slice is committed:

1. Run the plan's whole-build verification matrix.
2. Run one fresh read-only whole-tree critic against the specification and
   root-observed tree.
3. Repair findings through the affected build slice and repeat invalidated
   checks.
4. Run `code-simplify` once over the complete changed scope.
5. Run the complete applicable test suite and build after simplification.
6. Run a fresh simplification critic over the actual diff and behavior
   evidence.
7. Commit simplification separately when changed; create no empty commit.

## Authority and completion

- Allow task-owned local writes and focused commits.
- Finish with a verified local handoff or `BLOCKED`.
- Keep the task `active` and its lock held.
- Do not ship, complete the whole task, push, mutate a PR, merge, deploy,
  delete, force, take over a stale lock, or clean unrelated state.
