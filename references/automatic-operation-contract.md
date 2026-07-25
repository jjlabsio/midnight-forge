# Automatic Operation Contract

This reference is the only owner of behavior shared by every automatic
workflow operation.
Profile references own composition, profile-specific authority, and completion.
Stage skills remain mode-blind and do not load automatic contracts.

## Completion standard

Every automatic profile targets **solo-operated production**: one builder can
release the accepted outcome, observe failures, recover without data loss, and
continue changing the service safely. This standard does not require
generalization for hypothetical scale, unsupported use, or future product
scope.

Critics report technical findings and severity independently. The root owns
the current-delivery disposition for each actionable finding:

| Disposition | Required evidence and action |
| --- | --- |
| `fix-now` | An accepted success criterion is unmet; or an existing authority/safety invariant is violated in an accepted or currently supported operation and its impact is not acceptably contained or recoverable. Rework the bounded affected target. |
| `needs-user` | Repairing a current-delivery blocker changes an accepted outcome, removes or defers an accepted success criterion, or adds a new subsystem, state machine, operational protocol, or general-purpose infrastructure. Stop for the user's scope decision. |
| `current-delivery-nonblocking` | The finding concerns optional hardening, hypothetical scale, unsupported use, or another condition outside the accepted current outcome and does not violate an existing invariant. Do not rework it in this delivery. |
| `invalid` | The finding does not apply to the observed target or rests on incorrect evidence. Do not rework it. |

A critic assessment such as `changes_requested` is technical evidence, not an
unconditional rework command. The root does not repeat the critic's technical
review; it binds the finding to the accepted baseline and observed operating
conditions, records its disposition in the next handoff, and follows the table
above. Never silently remove or defer an accepted success criterion.

Do not create a follow-up task or standing finding backlog merely because a
finding is nonblocking. If safe current operation depends on an unsupported
condition or operator constraint, require that boundary in version-controlled
authoritative project documentation or executable configuration before
acceptance. Otherwise no durable finding record is required; a temporary MDF
handoff is not the authority for a long-lived operational constraint.

## State decisions

Use observable state, not elapsed caller time:

| Observed state | Root action |
| --- | --- |
| Executor or critic is `running` | Wait for its actual terminal response. |
| Caller `wait` timed out, the role is silent, or no update arrived | Keep waiting while the role remains `running`. These are not failure, stop, deadlock, completion, or replacement evidence. |
| Executor returned a successful terminal status with a complete reviewable report | Observe the target and evidence, persist the report, then dispatch the critic. |
| Executor ended terminally without a report | Follow **Terminal no-report transport failure**. Do not dispatch a critic or accept the attempt. |
| Executor returned any other terminal response | Persist any returned report as evidence and follow **Recovery** or a substantive stop. Do not dispatch a critic or accept the attempt. |
| Critic returned a successful terminal status with a complete `pass` report | Re-observe the bound target and let the root decide acceptance. |
| Critic returned a successful terminal status with `changes_requested` | Re-observe the bound target and disposition every actionable finding. Rework only `fix-now`, stop for `needs-user`, and permit acceptance when no current-delivery blocker remains. |
| Critic returned any other terminal response | Persist any returned report as evidence and follow **Recovery** or a substantive stop. |
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

A profile-declared independent read-only audit is a direct assessment, not an
artifact or implementation operation under this executor-to-critic sequence.
Do not add an executor or another critic unless the profile explicitly
requires one after resulting rework.

1. Before every actual executor or critic spawn, use the shared policy's
   `begin` contract and retain only its returned invocation ID.
2. Dispatch one skill-backed executor with the exact adapter, acceptance
   baseline, target, owned paths, checks, and stop rules. The adapter loads the
   primitives required by its public contract.
3. Wait until that executor returns an actual terminal response.
4. Re-read the actual artifact or diff, Git state, and command results.
5. Persist any returned executor report and root-observed changed paths when
   applicable.
6. Only after a successful terminal status with a complete reviewable report,
   dispatch one distinct fresh read-only critic with the actual target,
   canonical critic adapter, and original acceptance baseline. Exclude executor
   reasoning.
7. Wait for the critic's actual terminal response, then apply **Completion
   standard** and **State decisions**. In the root, disposition findings and
   accept, perform bounded rework, request the user-owned decision, or finish
   `BLOCKED`.

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
policy. After a `fix-now` disposition, rework the actual target and dispatch a
fresh critic until no current-delivery blocker remains or an existing
substantive stop condition blocks progress.

At an automatic call site:

- critic plus root acceptance replaces intermediate human confirmation;
- root review and commit replaces an executor commit or completion step.

## Verification reuse

For implementation work:

1. Run the focused RED, GREEN, regression, and build checks applicable to each
   bounded target.
2. After all planned targets are accepted, run the plan's full test/build
   matrix once against the whole tree.
3. Give reviewers and `ship` the existing command output and bound HEAD/diff.
   They inspect that evidence and identify gaps; they do not rerun an identical
   suite merely to reproduce valid evidence.
4. After rework, rerun the checks invalidated by the changed paths and behavior.
   Rerun the full matrix only when the impact cannot be bounded reliably.

Fresh evidence is still required when prior output is missing, failed, stale,
bound to another target, or insufficient for the applicable acceptance
criterion.

## DDD-class decision recovery

Only the root selects MDF-only `auto-doubt-driven-development`, and only for a
DDD-class non-trivial decision requiring fresh adversarial recovery. Every
automatic profile inherits this rule.

- Intercept a DDD-class trigger from a mode-blind stage or executor and route it
  through `auto-doubt-driven-development`.
- Never let an automatic executor enter standalone
  `doubt-driven-development`. Direct standalone build and DDD remain unchanged.
- Keep ordinary executor/critic findings in the operation sequence and apply
  the root disposition contract; they are not a DDD cycle. Stage adapters
  neither select nor load automatic DDD.
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
artifact under `.mdf/work/<work-id>/` before acceptance. Each report declares
`invocation_id: <id>` on its own line when it is linked from an attempt index.

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
   - include exactly one generic executor attempt index for the actual dispatch;
   - use `report: none` and preserve the raw terminal status;
   - set every accepted-result and critic field to `none`;
   - preserve the verbatim provider response, root-observed time, and
     retry/backoff context in the existing blocker or verification text.
4. Apply **Recovery**. Retry only when it permits re-entry; otherwise finish at
   the applicable substantive stop.

This procedure records no accepted executor result, critic result, or lifecycle
transition. Do not dispatch a critic for the failed attempt.

## Root handoff

After each accepted or terminally blocked operation, and before retrying a
terminal no-report transport failure, write the next immutable
`.mdf/work/<work-id>/handoff-NNN.md`:

```text
operation: <operation>
# Repeat exactly one generic line for each actual dispatch, in dispatch order.
attempt: <id> | role: <canonical-role> | report: <path | none> | status_b64: <base64url(raw-status)> | disposition: <accepted | not_used | unresolved>
accepted_executor_invocation_id: <id | none>
accepted_executor_report: <project-relative path | none>
accepted_critic_invocation_id: <id | none>
accepted_critic_report: <project-relative path | none>
critic_assessment: <pass | changes_requested | blocked | none>
accepted_artifact: <path and SHA-256 | none>
accepted_commit_oid: <full OID | none>
```

Handoff invariants:

- Write one generic attempt line per actual dispatch, in dispatch order. Omit a
  role until dispatched; never invent a placeholder invocation ID.
- The index is the only artifact linkage for routing analysis. With `report:
  none`, it records insufficient evidence rather than substituting the handoff
  as a report.
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
