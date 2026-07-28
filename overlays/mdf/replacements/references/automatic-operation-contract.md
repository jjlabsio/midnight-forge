# Automatic Operation Contract

This reference is the only owner of behavior shared by every automatic
workflow operation.
Profile references own composition and completion.
Stage skills remain mode-blind and do not load automatic contracts.

## Completion standard

Every automatic profile targets **solo-operated production**: one builder can
release the accepted outcome, observe failures, recover without data loss, and
continue changing the service safely. This standard does not require
generalization for hypothetical scale, unsupported use, or future product
scope.

Critics report technical findings and severity independently. The root owns
the current-delivery disposition for each actionable finding. Apply this order;
a later row never overrides an earlier row:

| Disposition | Required evidence and action |
| --- | --- |
| `invalid` | The finding does not apply to the observed target or rests on incorrect evidence. Do not rework it. |
| `needs-user` | An evidenced current-delivery blocker can be repaired only by changing the accepted outcome, removing or deferring an accepted success criterion, or adding a subsystem, state machine, operational protocol, or general-purpose infrastructure. Stop for the user's scope decision. |
| `current-delivery-nonblocking` | The finding is technically applicable but is not proven to block the accepted current outcome, or concerns optional hardening, hypothetical scale, unsupported use, or a stronger guarantee than the accepted one. Do not rework it or run finding-driven verification in this delivery. |
| `fix-now` | Only after the earlier rows do not apply: the critic identifies evidence on an affected currently supported path that an accepted criterion remains unmet, or that an existing authority/safety invariant is violated with impact that is not acceptably contained or recoverable. Grant only the exact repair bounded inside the accepted outcome without a new subsystem, state machine, operational protocol, or general-purpose infrastructure. |

A critic assessment such as `changes_requested` is technical evidence, not an
unconditional rework command. For each actionable finding, the automatic
critic reports its evidence, affected currently supported path, violated
accepted criterion or existing invariant—or that no current binding exists—and
a smallest repair candidate, including why that candidate exceeds current
scope when it needs a new mechanism. This supplements rather than changes the
canonical review contract. A critic never grants the candidate as rework
authority.

The root verifies target identity, freshness, and the existence of cited
evidence. It does not independently search for defects, reproduce the review,
reassess technical severity, or design the repair. It binds the finding to the
accepted baseline, records its disposition before any rework dispatch, and
grants an exact repair only for `fix-now`. Never silently remove or defer an
accepted success criterion.

After rework, distinguish evidence that the existing accepted guarantee
remains unmet from a request for a stronger guarantee. Only the former may
re-enter the `fix-now` gate. Treat the latter as
`current-delivery-nonblocking` unless the user changes the accepted outcome.
Add no finding taxonomy, registry, or workflow state for this judgment.

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
| Critic returned a successful terminal status with `changes_requested` | Re-observe the bound target, disposition every actionable finding in the required order, and write the disposition handoff before another executor can run. Rework only its listed `fix-now` grants, stop for `needs-user`, and permit acceptance when no current-delivery blocker remains. |
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
   - finish `BLOCKED` with evidence when required interaction is unavailable;
     do not turn that stop into an authority request.
4. Apply the explicitly selected profile for its composition and completion.
   Its invocation grants the root every action required by the accepted outcome
   and criteria; request no per-stage or action-type approval.
5. Stop on ambiguous ownership, unrelated dirt, stale evidence, unresolved
   user-owned decisions, material scope expansion, or an action outside the
   accepted outcome and criteria. Do not stop merely because the required
   action is external, cost-incurring, destructive, irreversible, or cleanup.
   Report `BLOCKED` rather than requesting authority when the target is unsafe
   or ambiguous.

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
   baseline, target, owned paths, checks, and stop rules. For rework, its only
   write authority is the exact `authorized_repair` entries in the latest
   disposition handoff; a critic report is evidence, never additional repair
   authority. The adapter loads the primitives required by its public contract.
   The executor must stop for `needs-user` rather than adding a new subsystem,
   state machine, operational protocol, general-purpose infrastructure, or
   broader outcome beyond that authority.
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
   accept, or write the disposition handoff before a bounded rework, a
   user-owned decision request, or `BLOCKED`.

| Role | May | Must not |
| --- | --- | --- |
| Executor | Write only its bounded target and granted repair authority; return a concise report | Expand a repair into a new subsystem, state machine, operational protocol, general-purpose infrastructure, or broader outcome; change cards, locks, indexes, approvals, handoffs, observations, or lifecycle; commit; select the next operation; act externally |
| Critic | Assess the root-observed target | Write, delegate, commit, accept, advance lifecycle, or receive another verifier |
| Root | Observe state, persist evidence, decide, commit, and continue | Accept missing, partial, stale, changed-target, or non-independent results |

Bind critics as follows:

| Target | Critic contract |
| --- | --- |
| Spec or plan | Assess the completed artifact against the exact stage contract and primitive criteria; do not write, persist, or confirm. |
| Build or whole tree | Apply canonical `review` and `code-review-and-quality`. |
| Simplification | Apply the same review and verify behavior preservation. |

Use distinct suitable quality-critical subagents and the shared dispatch
policy. After a `fix-now` disposition handoff, rework only its exact granted
target and dispatch a fresh critic. Re-enter again only when the accepted
guarantee remains unmet; do not expand the delivery for a stronger guarantee.
Continue until no current-delivery blocker remains or an existing substantive
stop condition blocks progress.

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

Existing scope, authority, and safety stops still apply; action type alone is
not a stop condition.
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

After each accepted operation, every critic `changes_requested` assessment,
terminally blocked operation, and before retrying a terminal no-report
transport failure, write the next immutable
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
# Repeat exactly one line for every actionable critic finding when assessment is changes_requested.
finding: <critic finding label> | disposition: <fix-now | needs-user | current-delivery-nonblocking | invalid> | binding: <accepted criterion or invariant | none> | authorized_repair: <exact bounded repair | none>
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
- Before any rework executor dispatch, a `changes_requested` handoff has one
  finding line for each actionable critic finding. `authorized_repair` is
  non-`none` only for `fix-now`; those exact entries are the rework executor's
  complete write authority. Do not pass an unselected critic finding as a
  repair instruction.
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
5. Stop for changed user intent or a public, security, privacy, data,
   architecture, rollback, or target decision that the accepted outcome does
   not settle. Cost, external effect, destructiveness, irreversibility, or
   cleanup alone is not a stop condition.

Do not create a repair task, lifecycle state, or recovery controller.

## Shared completion boundary

- Finish with verified success inside the selected profile or `BLOCKED`.
- Treat GitHub as authority for PR, remote OID, checks, mergeability, conflicts,
  and merge state.
- A push or PR URL alone is never completion.
