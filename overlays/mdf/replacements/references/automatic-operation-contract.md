# Automatic Operation Contract

This reference owns behavior shared by every automatic workflow operation.
Profile references own composition, profile-specific authority, and completion.
Stage skills remain mode-blind and do not load automatic contracts.

## State decisions

Use observable state, not elapsed caller time:

| Observed state | Root action |
| --- | --- |
| Executor or critic is `running` | Wait for its actual terminal response. |
| Caller `wait` timed out, the role is silent, or no update arrived | Keep waiting while the role remains `running`. These are not failure, stop, deadlock, completion, or replacement evidence. |
| Executor returned a terminal report | Observe the target and evidence, persist the report, then dispatch the critic. |
| Executor ended terminally without a report | Follow **Terminal no-report transport failure**. Do not dispatch a critic or accept the attempt. |
| Critic returned `changes_requested` | Rework the same actual target and dispatch a fresh critic. |
| A DDD-class finding has materially changed evidence | Re-enter the affected operation and obtain a fresh adversarial review. |
| A DDD-class review repeats the core finding without changed evidence | Stop `BLOCKED` or request the user-owned decision. |

Never interrupt or replace a running role merely because a caller wait timed
out, the role stayed silent, a deadline approached, or an agent slot remained
occupied. Raw dispatch count alone never causes `BLOCKED`.

## Root boundary

Before every operation:

1. Treat task creation or activation and the workflow as independent
   operations. Read the exact task, card, lock, worktree, branch, and latest
   handoff; require no workflow-readiness field or task-level action grant.
2. Re-read Git, artifacts, and applicable remote state.
3. Resolve intent:
   - continue when outcome, constraints, and delegated judgment make the next
     stage unambiguous;
   - use `interview-me` for materially different user outcomes, unresolved
     user-owned trade-offs, or missing intent that specification cannot settle;
   - use `idea-refine` only for requested ideation, stress-testing, or product
     direction, never for delegated technical alternatives;
   - stop when required interaction is unavailable.
4. Apply only the explicitly selected profile. Its invocation grants its
   ordinary operations; request no per-stage ceremonial approval.
5. Stop on ambiguous ownership, unrelated dirt, stale evidence, unresolved
   user-owned decisions, material scope expansion, or action outside the
   profile.

Only the root may select, skip, accept, retry, commit, advance lifecycle, write
canonical handoffs or observations, act externally, or synthesize the result.

Always keep one writer per shared worktree, treat reports as evidence rather
than authority, and use no nested delegation, runtime controller, or
machine-only protocol.

## Operation sequence

For every automatic artifact or implementation operation:

1. Dispatch one skill-backed executor with the exact adapter, acceptance
   baseline, target, owned paths, checks, and stop rules. The adapter loads the
   primitives required by its public contract.
2. Wait until that executor returns an actual terminal response.
3. Re-read the actual artifact or diff, Git state, and command results.
4. Persist the executor report and root-observed changed paths when applicable.
5. Dispatch one distinct fresh read-only critic with the actual target,
   canonical critic adapter, and original acceptance baseline. Exclude executor
   reasoning.
6. In the root, accept, rework, or finish `BLOCKED`.

| Role | May | Must not |
| --- | --- | --- |
| Executor | Write only its bounded target; return a concise report | Change cards, locks, indexes, approvals, handoffs, observations, or lifecycle; commit; select the next operation; act externally |
| Critic | Assess the root-observed target | Write, delegate, commit, accept, advance lifecycle, or receive another verifier |
| Root | Observe state, persist evidence, decide, commit, and continue | Accept missing, partial, stale, changed-target, or non-independent results |

Bind critics as follows:

| Target | Critic contract |
| --- | --- |
| Spec or plan | Assess the completed artifact against the exact stage contract and primitive criteria; do not write, persist, or confirm. |
| Build or whole tree | Apply canonical `review` and `code-review-and-quality`. |
| Simplification | Apply the same review and verify behavior preservation. |

Use distinct suitable quality-critical subagents and the shared dispatch
policy. After `changes_requested`, rework the actual target and dispatch a
fresh critic until accepted or an existing substantive stop condition blocks
progress.

At an automatic call site:

- critic plus root acceptance replaces intermediate human confirmation;
- root review and commit replaces an executor commit or completion step.

## DDD-class decision recovery

Only the root selects MDF-only `auto-doubt-driven-development`, and only for a
DDD-class non-trivial decision requiring fresh adversarial recovery. Every
automatic profile inherits this rule.

- Intercept a DDD-class trigger from a mode-blind stage or executor and route it
  through `auto-doubt-driven-development`.
- Never let an automatic executor enter standalone
  `doubt-driven-development`. Direct standalone build and DDD remain unchanged.
- Keep ordinary executor/critic `changes_requested` in the operation sequence;
  it is not a DDD cycle. Stage adapters neither select nor load automatic DDD.
- Re-enter while a changed artifact, changed contract, or newly verified
  evidence materially addresses a substantive finding and a fresh review
  evaluates that changed target. Apply no numerical cycle cap.
- Record `resolved` only when a fresh review finds no substantive issue or only
  explicitly harmless or trivial findings. Then continue under the operation's
  normal acceptance criteria; `resolved` never accepts a partial or stale
  operation.
- Treat an unchanged-target review or repeated core finding without new
  relevant evidence as no progress. Stop `BLOCKED` or request the user-owned
  decision.

Existing scope, authority, safety, and destructive-action stops still apply.
Preserve every upstream acceptance, TDD, verification, fallback, and stop
criterion. Standalone stage behavior remains unchanged.

Record DDD recovery in the existing role reports and handoff. In a returned
role report, record provider failures and backoff separately with response,
time, and retry context. A later user resume does not reset those facts.
Transport failures are neither quality findings nor DDD cycles. Add no
controller, retry schema, or lifecycle state.

## Evidence

### Before each executor attempt

1. Reject unrelated dirt.
2. Record the full stage-start commit OID.

### After each executor attempt

Run from the target worktree:

```bash
node <plugin-root>/skills/auto-workflow/scripts/changed-paths.mjs \
  <exact-worktree-root> <stage-start-commit>
```

- Attach the exact output as `Changed paths (operation scope)` to a returned
  executor report.
- Reuse the same stage-start baseline for rework attempts.
- Treat changed paths as cumulative evidence, not ownership or acceptance. The
  executor neither calculates nor claims them.
- For spec and plan, record the output path and SHA-256 instead.
- For critics, record the bound target.

Persist each returned executor and critic report as a separate immutable
artifact under `.mdf/work/<work-id>/` before acceptance. Pass its path to the
terminal observation append.

An executor report contains only applicable fields:

- invocation ID;
- operation and status;
- input and output artifact references;
- commands and results;
- findings, assumptions, and blockers.

Never put `Next`, allowed actions, acceptance, lifecycle transitions, or mode
policy in a role report.

### Terminal no-report transport failure

After an executor ends terminally without a report:

1. Run the changed-path helper from the original stage-start commit.
2. Preserve its exact changed paths and root-observed Git and verification
   results in the next handoff's verification text.
3. Write the immutable handoff before any retry:
   - include only the actual executor attempt line;
   - use `report: none` and preserve the raw terminal status;
   - set every accepted-result and critic field to `none`;
   - preserve the verbatim provider response, root-observed time, and
     retry/backoff context in the existing blocker or verification text.
4. Append the terminal observation with this handoff as its artifact reference.
   Create no parallel routing artifact.
5. Re-read the handoff and observation.
6. Apply **Recovery**. Retry only when it permits re-entry; otherwise finish at
   the applicable substantive stop.

This procedure records no accepted executor result, critic result, or lifecycle
transition. Do not dispatch a critic for the failed attempt.

## Root handoff

After each accepted or terminally blocked operation, and before retrying a
terminal no-report transport failure, write the next immutable
`.mdf/work/<work-id>/handoff-NNN.md`:

```text
operation: <operation>
# Repeat exactly one role-specific line for each dispatch, in dispatch order;
# omit roles not yet dispatched.
executor_attempt: <invocation-id> | report: <project-relative path | none> | status: <raw-status>
critic_attempt: <invocation-id> | report: <project-relative path | none> | status: <raw-status> | assessment: <pass | changes_requested | blocked | none>
accepted_executor_invocation_id: <id | none>
accepted_executor_report: <project-relative path | none>
accepted_critic_invocation_id: <id | none>
accepted_critic_report: <project-relative path | none>
critic_assessment: <pass | changes_requested | blocked | none>
accepted_artifact: <path and SHA-256 | none>
accepted_commit_oid: <full OID | none>
```

Handoff invariants:

- Write one role-specific attempt line per actual dispatch, in dispatch order.
  Omit a role until dispatched; never invent a placeholder invocation ID.
- Use the matching attempt line as the role-specific terminal-observation link.
  With `report: none`, use the handoff itself as the artifact reference.
- Record task and profile identity, Git state, verification, critic outcome,
  blockers, and the root-owned cursor.
- Use `report: none` only when no report returned and `assessment: none` only
  when no critic assessment exists. Never fabricate a report.
- Use `none` for every unaccepted result in a blocked or terminal no-report
  handoff.
- Never rewrite an earlier handoff.
- On resume, derive the next operation from the profile and actual state. Never
  trust the cursor over the card, lock, artifacts, Git, or remote state.

## Recovery

On failure:

1. Keep the same task, worktree, branch, and lock.
2. Revalidate HEAD and base evidence, the acceptance baseline, applicable spec
   or plan scope and dependencies, completed commits, and the current tree.
3. Re-enter the earliest invalidated operation.
4. Make no source change for external or flaky evidence alone.
5. Stop for changed user intent, public behavior, security, privacy or data
   boundaries, material architecture, cost, rollback, or destructive action.

Do not create a repair task, lifecycle state, or recovery controller.

## Shared completion boundary

- Finish with verified success inside the selected profile or `BLOCKED`.
- Treat GitHub as authority for PR, remote OID, checks, mergeability, conflicts,
  and merge state.
- A push or PR URL alone is never completion.
