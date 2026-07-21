---
name: auto-workflow-pr
description: "Run MDF's complete implementation, ship, commit, push, and GitHub PR workflow."
---

# auto-workflow-pr

## Contract and authority

- Continue work already implemented through repeated `auto-workflow` runs; do
  not repeat completed implementation slices.
- Load `../../references/auto-workflow-contract.md` and pass
  `mode: auto-workflow-pr` to downstream MDF skills.
- Treat the loaded contract as the source of truth for the shared auto-mode
  middle stages.
- Grant push and PR create/update authority only after fresh preflight.
- Never authorize merge, deploy, deletion, stale-lock takeover, force
  operations, or unrelated cleanup.

## Startup and ownership

1. Run the contract's **Shared auto-mode startup task/worktree resolution** for
   the current linked worktree.
2. Resolve the latest spec/plan revisions and current Git state for the same
   task, worktree, branch, and lock.
3. Stop when task, worktree, branch, lock, spec, plan, or ownership facts are
   missing, conflicting, or mismatched. Do not create replacement state.
4. Keep the task active and its lock held through implementation, ship, PR
   create/update, latest-head checks, mergeability, and conflict validation.

## Implementation continuation

Follow the shared auto-mode middle-stage lifecycle.

### Pending plan slices

1. Run the local implementation loop defined by the shared contract.
2. Treat each plan-slice commit as provisional progress, not completion of the
   whole MDF task.
3. Re-read the canonical plan and task card after each slice.
4. Repeat until every approved slice is complete, then continue to ship.

### No pending plan slices

1. Treat this as finalization, not a stop.
2. Do not invent implementation work or ignore the specification.
3. Use the latest approved spec as the acceptance and scope baseline.
4. Use the plan and prior evidence to confirm that every implementation slice
   is covered.
5. Continue in this order:

   ```text
   latest verification/evidence check -> ship -> github-pr PR handoff and
   consumer checks -> whole MDF task completion and lock release
   ```

6. If code or scope changed after the last review, rerun affected tests and
   review before ship.

## Delivery and completion

- `plan task complete` requires its tests, build, review, simplification, and
  local commit to pass.
- `MDF task done` means the complete work item is ready for final delivery.
- The implementation loop commits intended changes before ship.
- After ship returns GO, run fresh checks for branch, remote, mergeability,
  authentication, clean tree, and open-PR state while the lock is held.
- If intended uncommitted changes remain, invoke `github-commit`, rerun the
  affected review and ship checks, and repeat preflight.
- Keep the lock while `github-pr` pushes or updates the PR, verifies the pushed
  head, waits for all latest related/required checks to finish and pass, and
  confirms mergeability with no unresolved conflict.
- If a consumer fails, record its evidence and re-enter the shared recovery
  protocol on the same task. Do not create a repair task or new state.
- Perform the task skill's normal completion mutation and release the lock only
  after every delivery gate passes.
- Do not complete the task before latest-head, mergeability, and conflict gates
  pass.

## PR handoff

1. Push the current branch.
2. Update the matching open PR, or create one when none exists.
3. Query GitHub before retrying an uncertain create result; never create a
   duplicate PR.
4. Record the PR URL or terminal failure.
5. Stop after recording that result.

## Stop conditions

Stop for:

- ship NO-GO;
- lock, worktree, or branch conflicts;
- dirty unrelated changes;
- missing GitHub authority;
- an unmergeable base;
- failed or ambiguous push or PR mutation.

After the PR URL or terminal failure is recorded, do not merge, deploy, delete,
or clean up branches/worktrees.
