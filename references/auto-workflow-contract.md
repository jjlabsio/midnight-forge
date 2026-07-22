# Automatic Workflow Profiles

This reference is the only owner of automatic workflow composition. Stage
skills are mode-blind and do not load it.

## Root boundary

Before work, the root:

1. Resolves the exact task, card, lock, worktree, branch, and current handoff.
2. Re-reads Git and artifact state; a mode name or handoff is never authority.
3. Runs exact upstream `using-agent-skills` discovery and loads every applicable
   primitive.
4. Selects one profile below. Only the root selects, skips, accepts, retries,
   commits, advances lifecycle, or performs an external action.
5. Stops for ambiguous ownership, unrelated dirt, invalidated evidence,
   unresolved material decisions, or authority outside the selected profile.

Keep one writer in a shared worktree. Do not add a runtime controller, nested
delegation, or a machine-only workflow protocol.

## Operation binding

Automatic artifact and implementation operations use a root-dispatched
skill-backed executor followed by a fresh read-only critic:

1. Give the executor the exact stage adapter, applicable upstream primitives,
   acceptance baseline, target, owned paths, required checks, and stop rules.
2. The executor performs the stage work and writes only its bounded target. A
   spec or plan executor may write its exact assigned artifact under
   `.mdf/work/<work-id>/`; it cannot change cards, locks, indexes, approvals,
   root handoffs, observations, or lifecycle state. It returns a concise stage
   report and does not commit, choose the next operation, or perform external
   actions.
3. After the executor has ended, the root re-reads the actual artifact or diff,
   Git state, and command results. For a Git-mutating operation, the root runs
   the changed-path helper and attaches its exact output to the persisted stage
   report before dispatching the critic.
4. Give the critic that actual target, the canonical critic adapter, and the
   original acceptance baseline without executor reasoning. Spec and plan
   critics evaluate the completed artifact against their exact stage command
   contract and primitive acceptance criteria; they do not execute its writing,
   persistence, or confirmation instructions. Build, whole-tree, and
   simplification critics apply canonical `review` and
   `code-review-and-quality`; simplification also checks behavior preservation.
   A critic is read-only and does not delegate or receive another verifier.
5. The root accepts, requests rework, or stops. It alone chooses what runs next.

The executor and critic must be distinct suitable quality-critical subagents.
Use the shared dispatch policy. Missing, partial, stale, changed-target, or
non-independent results do not pass. Bound rework to three attempts per
operation, then stop `BLOCKED`.

This binding explicitly ports two upstream checkpoints for automatic runs:

- the critic and root acceptance replace an intermediate human confirmation;
- root review and commit replace a stage executor's commit or completion step.

All upstream acceptance, TDD, verification, fallback, and stop criteria still
apply. Standalone stage behavior is unchanged.

## Stage reports and root handoff

Each executor returns a concise report with only the applicable fields:

- invocation ID;
- operation and status;
- input and output artifact references;
- commands and results;
- findings, assumptions, and blockers.

The root persists that returned report as the immutable stage report. For a
Git-mutating operation, the root adds the changed-path evidence described
below; the executor does not calculate or claim that evidence.

For a Git-mutating operation, the root records the full stage-start commit OID
before dispatch and runs this command from the target worktree after each
executor attempt:

```bash
node <plugin-root>/skills/auto-workflow/scripts/changed-paths.mjs \
  <exact-worktree-root> <stage-start-commit>
```

The root attaches the exact Markdown output as `Changed paths (operation
scope)` when it persists the executor's returned report. Rework attempts use
the same operation baseline, so the path list is cumulative and never claims
per-attempt ownership. The helper reports tracked and untracked
repository-relative paths; it does not
attribute ownership, inspect content, or establish acceptance. The root must
reject unrelated pre-existing dirt before dispatch. Spec and plan report their
output path and hash instead. Read-only critics report their bound target.

For a task-linked run, the root persists every executor and critic report as a
separate immutable artifact under `.mdf/work/<work-id>/` before acceptance. Do
not rely on conversation history, a worktree, or a branch ref as the only copy.

Do not put `Next`, allowed actions, acceptance, lifecycle transitions, or mode
policy in a stage report.

After each accepted or terminally blocked operation, the root writes the next
immutable `.mdf/work/<work-id>/handoff-NNN.md`. Keep it concise and include this
explicit role-specific record:

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

Repeat one `executor_attempt` or `critic_attempt` line per dispatch, in dispatch
order. Also record task/profile identity, current Git state, verification and
critic outcome, blockers, and the root-owned workflow cursor. Never rewrite an
earlier handoff. When an attempt has no returned report, record its raw terminal
state and `report: none`; never fabricate a worker report. Use `assessment:
none` when no critic assessment exists. A blocked handoff uses `none` for every
unaccepted result field.
On resume, derive the next operation from this profile and actual state; never
trust the cursor over the card, lock, artifacts, Git, or remote state.

## Profiles

### `auto-workflow`

```text
intent preflight
-> spec executor -> spec critic -> root acceptance
-> plan executor -> plan critic -> root acceptance
-> per-slice build loop
-> whole-build verification
-> whole-build review
-> one whole-change simplification pass
-> simplification critic
-> root simplification commit when changed
-> local handoff
```

The profile authorizes task-owned local writes and focused commits. It omits
ship, whole-task completion, push, PR mutation, merge, deploy, deletion, force,
stale-lock takeover, and unrelated cleanup. Keep the task active and lock held.

### `auto-workflow-pr`

Run the same local profile, then:

```text
root invokes canonical ship fan-out and synthesizes GO/NO-GO
-> root invokes github-pr
-> latest-head checks, mergeability, and conflict validation
-> active task + held lock + merged-delivery handoff
-> user merges the PR
-> github-after-merge verifies the merge and finalizes task/lock
```

Ship uses its exact upstream three-specialist fan-out. Do not add an outer ship
executor, critic, verifier, or coordinator. This profile authorizes only the
root-owned push and matching PR create/update after fresh preflight. The
post-merge finalizer owns later task/lock completion and cleanup. This profile
never authorizes merge, deploy, deletion, force, or stale-lock takeover.

### `quick-workflow-pr`

Use only when the user explicitly selects the bounded small-change workflow.

```text
scope and authority preflight
-> bounded build executor
-> root observation
-> bounded-change critic
-> root commit
-> root invokes github-pr
-> latest-head checks, mergeability, and conflict validation
-> active task + held lock + merged-delivery handoff
-> user merges the PR
-> github-after-merge verifies the merge and finalizes task/lock
```

The user request and current task context are the acceptance baseline. This
profile omits spec, plan, simplification, ship, separate whole-build
verification, and separate whole-tree review. It does not create empty gates.
Its bounded build is the explicit planless-target port of the upstream build
contract: the executor performs the applicable RED, GREEN, regression, and
build steps, while the root owns review and commit. Task completion is a
post-merge operation performed by `github-after-merge`.

## Per-slice build loop

For every ready plan slice:

```text
root selects one slice
-> build executor performs RED -> GREEN -> regression -> build
-> root observes the actual diff and verification
-> slice critic reviews the slice against its plan and spec
-> root commits exact slice paths
-> root records the accepted slice and commit OID in its handoff
-> root re-reads plan, card, lock, and Git before selecting another slice
```

Do not invoke upstream `build auto`; the profile owns iteration. Do not run
code simplification in a slice. Actionable findings return to the same slice
and repeat its executor/critic loop before commit.

After every approved slice is committed:

1. Run the plan's whole-build verification matrix.
2. Dispatch one fresh read-only whole-tree critic against the full
   specification and root-observed tree.
3. Repair actionable findings through the affected build slice and repeat the
   invalidated verification and review.
4. Run `code-simplify` once over the complete changed scope.
5. Run the complete applicable test suite and build after simplification;
   focused affected checks may be additional evidence, not substitutes.
6. Dispatch a fresh simplification critic over the actual simplification diff
   and behavior-preservation evidence.
7. Commit simplification separately when it changed files. Skip an empty
   simplification commit.

## Recovery

On failure, keep the same task, worktree, branch, and lock. Revalidate:

- whether the evidence matches current HEAD and base;
- whether the spec still represents user intent;
- whether the plan still represents valid dependencies and scope;
- whether completed commits and the current tree match the proposed re-entry.

Re-enter the earliest invalidated operation. External or flaky evidence causes
no source change. A changed user goal, public behavior, security/privacy/data
boundary, material architecture, cost, rollback, or destructive action stops
for the user. Do not create repair tasks, lifecycle states, or a recovery
controller.

## Completion

An automatic run ends with verified success inside its profile or `BLOCKED`.
For PR profiles, GitHub is authoritative for the open PR, remote OID, checks,
mergeability, and conflicts. A push or PR URL alone is not completion. The
delivery task remains `active` with its lock held until
`github-after-merge` verifies the accepted PR revision is merged and applies
the task finalization contract.
