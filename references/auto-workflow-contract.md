# Automatic Workflow Profiles

This reference is the only owner of automatic workflow composition. Stage
skills are mode-blind and do not load it.

## Root boundary

Before every operation:

1. Resolve the exact task, card, lock, worktree, branch, and latest handoff.
2. Re-read Git, artifacts, and applicable remote state.
3. Run exact upstream `using-agent-skills` discovery; load every applicable
   primitive.
4. Select one profile below.
5. Stop on ambiguous ownership, unrelated dirt, stale evidence, unresolved
   material decisions, or authority outside the profile.

Root-only actions:

- select, skip, accept, retry, commit, and advance lifecycle;
- write canonical root handoffs and observations;
- perform external actions and final synthesis.

Always:

- keep one writer per shared worktree;
- treat reports as evidence, not authority;
- use no nested delegation, runtime controller, or machine-only protocol.

## Operation binding

Use this sequence for automatic artifact and implementation operations:

1. Dispatch one skill-backed executor with the exact adapter, applicable
   primitives, acceptance baseline, target, owned paths, checks, and stop rules.
2. Wait for its actual terminal response.
3. Re-read the actual artifact or diff, Git state, and command results.
4. Persist the executor report; add root-observed changed paths when applicable.
5. Dispatch one distinct fresh read-only critic with the actual target,
   canonical critic adapter, and original acceptance baseline. Exclude executor
   reasoning.
6. Accept, rework, or finish `BLOCKED` in the root.

| Role | May | Must not |
| --- | --- | --- |
| Executor | Write only its bounded target; return a concise report | Change cards, locks, indexes, approvals, handoffs, observations, or lifecycle; commit; select the next operation; act externally |
| Critic | Assess the root-observed target | Write, delegate, commit, accept, advance lifecycle, or receive another verifier |
| Root | Observe state, persist evidence, decide, commit, and continue | Accept missing, partial, stale, changed-target, or non-independent results |

Critic binding:

- Spec and plan: assess the completed artifact against the exact stage contract
  and primitive criteria; do not execute writing, persistence, or confirmation.
- Build and whole-tree: apply canonical `review` and
  `code-review-and-quality`.
- Simplification: apply the same review and verify behavior preservation.

Use distinct suitable quality-critical subagents and the shared dispatch
policy. Allow at most three executor/critic attempts per operation.

Automatic call-site ports:

- critic plus root acceptance replaces an intermediate human confirmation;
- root review and commit replaces an executor commit or completion step.

Preserve every upstream acceptance, TDD, verification, fallback, and stop
criterion. Standalone stage behavior is unchanged.

## Stage reports and root handoff

Executor report; include only applicable fields:

- invocation ID;
- operation and status;
- input and output artifact references;
- commands and results;
- findings, assumptions, and blockers.

Root evidence rules:

1. Persist every executor and critic report as a separate immutable artifact
   under `.mdf/work/<work-id>/` before acceptance.
2. For a Git-mutating operation, record the full stage-start commit OID before
   dispatch.
3. After every executor attempt, run from the target worktree:

   ```bash
   node <plugin-root>/skills/auto-workflow/scripts/changed-paths.mjs \
     <exact-worktree-root> <stage-start-commit>
   ```

4. Attach the exact output as `Changed paths (operation scope)` to the persisted
   executor report. Reuse the same baseline for rework attempts.
5. Treat the output as cumulative path evidence, not ownership or acceptance.
   The executor does not calculate or claim it.
6. Reject unrelated dirt before dispatch. For spec and plan, record output path
   and SHA-256 instead. For critics, record the bound target.

Do not put `Next`, allowed actions, acceptance, lifecycle transitions, or mode
policy in a stage report.

After each accepted or terminally blocked operation, write the next immutable
`.mdf/work/<work-id>/handoff-NNN.md`:

```text
operation: <operation>
executor_attempt: <invocation-id> | report: <project-relative path | none> | status: <raw-status>
critic_attempt: <invocation-id> | report: <project-relative path | none> | status: <raw-status> | assessment: <pass | changes_requested | blocked | none>
accepted_executor_invocation_id: <id | none>
accepted_executor_report: <project-relative path | none>
accepted_critic_invocation_id: <id | none>
accepted_critic_report: <project-relative path | none>
critic_assessment: <pass | changes_requested | blocked>
accepted_artifact: <path and SHA-256 | none>
accepted_commit_oid: <full OID | none>
```

Handoff rules:

- Write one attempt line per dispatch, in dispatch order.
- Record task/profile identity, Git state, verification, critic outcome,
  blockers, and the root-owned cursor.
- Use `report: none` for no returned report and `assessment: none` for no critic
  assessment. Never fabricate a report.
- Use `none` for every unaccepted result in a blocked handoff.
- Never rewrite an earlier handoff.
- On resume, derive the next operation from the profile and actual state; never
  trust the cursor over card, lock, artifacts, Git, or remote state.

## Profiles

### `auto-workflow`

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

### `auto-workflow-pr`

1. Run or resume `auto-workflow` through its accepted local result.
2. Invoke canonical `ship` from the root.
3. Invoke `github-pr` after GO and fresh preflight.
4. Verify remote OID, latest-head checks, mergeability, and conflicts.
5. Write the merged-delivery handoff; keep task `active` and lock held.
6. Stop for the user to merge.
7. After merge, `github-after-merge` verifies the accepted revision, completes
   the task, releases the lock, and performs its cleanup contract.

Ship uses the exact upstream three-specialist parallel fan-out and root merge.
Do not add an outer ship executor, critic, verifier, or coordinator.

Authority:

- Allow root-owned push and matching PR create/update after fresh preflight.
- Omit merge, deploy, deletion, force, stale-lock takeover, and unrelated
  cleanup before post-merge finalization.

### `quick-workflow-pr`

Use only when the user explicitly selects the bounded small-change workflow.

1. Validate scope and authority.
2. Run one bounded build executor.
3. Observe the actual diff and checks.
4. Run one fresh bounded-change critic.
5. Rework through the same pair or commit in the root after acceptance.
6. Invoke `github-pr`; verify remote OID, latest-head checks, mergeability, and
   conflicts.
7. Write the merged-delivery handoff; keep task `active` and lock held.
8. Stop for the user to merge.
9. After merge, run `github-after-merge` finalization.

Use the user request and current task context as the acceptance baseline. The
bounded build is the planless port of upstream build: retain applicable RED,
GREEN, regression, and build steps; keep review and commit in the root.

Omit spec, plan, simplification, ship, separate whole-build verification, and
separate whole-tree review. Create no empty gates. Omit merge, deploy, deletion,
force, stale-lock takeover, and unrelated cleanup before finalization.

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

## Recovery

On failure:

1. Keep the same task, worktree, branch, and lock.
2. Revalidate HEAD/base evidence, spec intent, plan scope/dependencies, completed
   commits, and the current tree.
3. Re-enter the earliest invalidated operation.
4. Make no source change for external or flaky evidence alone.
5. Stop for changed user intent, public behavior, security/privacy/data
   boundaries, material architecture, cost, rollback, or destructive action.

Do not create a repair task, lifecycle state, or recovery controller.

## Completion

- Finish with verified success inside the selected profile or `BLOCKED`.
- Treat GitHub as authority for PR, remote OID, checks, mergeability, conflicts,
  and merge state.
- Do not treat a push or PR URL as completion.
- Keep a delivery task `active` with its lock held until `github-after-merge`
  verifies the accepted revision and applies task finalization.
