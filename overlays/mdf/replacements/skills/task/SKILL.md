---
name: task
description: "Manage one local MDF task lifecycle from canonical project state."
---

# task

Manage one task's intent and local lifecycle. Load
[`mdf-preserved-contract.md`](../../references/mdf-preserved-contract.md) first.
Keep semantic judgment in the model; do not add a task controller or make this
skill depend on a consuming workflow.

## Preflight

Before every operation:

1. Resolve the unique canonical root from `.mdf/project/init.json`. A linked
   `<root>/.worktrees/<branch>` uses `<root>/.mdf/`.
2. Require readable user/project init, `.mdf/index.jsonl`, `.mdf/work/`, and
   `.mdf/locks/`; reject symlink escapes and ambiguous roots.
3. Read complete cards and locks before the derived index.
4. Resolve exactly one four-digit `task_id` from `.mdf/work/*/item.md`; never
   infer it from a title or branch.
5. Read the complete card, `Files`, `Criteria`, `Log`, artifacts, dependencies,
   branch, worktree, and lock.

For an explicit ID, collect repeatable facts with:

```bash
node <plugin-root>/skills/task/scripts/task-brief.mjs <task-id>
```

- Pass only a one-to-four-digit ID.
- Treat successful JSON as facts, never semantic judgment or authority.
- Stop on a non-zero result.
- Keep the helper read-only; it must not mutate MDF state, Git, or external
  state.

### Index preflight

- Treat `item.md` as authority and `index.jsonl` as a rebuildable projection.
- Normalize version-0 rows in memory; write new rows with `schema_version: 2`.
- When cards, locks, and tombstones are unambiguous, keep one recovery copy,
  compact the index, and re-read it. Never rewrite card history.
- Ignore malformed historical rows alone. Stop the affected operation for an
  unknown schema, malformed card, duplicate ID, conflicting lock, or ambiguous
  tombstone.

## Operations

| Invocation | Action | End state |
| --- | --- | --- |
| create or queue | Record the user's intent without activating work. | `queue` |
| bare `task <id> work` | Activate, report the briefing, and stop. | `active` |
| `task <id> work` with explicit subsequent work | Activate and return verified facts without a standalone briefing. | `active`; caller continues |
| resume active task | Reuse the recorded worktree, branch, and lock. | `active` |
| `task <id> done` | Verify completion evidence, finalize, and release the lock. | `done` |
| `task <id> drop` | Remove the exact explicitly named task and preserve a tombstone. | removed |
| completed-task handoff | Read persisted facts without replaying lifecycle. | unchanged |
| `github-after-merge` | Apply verified idempotent post-merge finalization. | `done` |

Task does not select, route, authorize, or execute a later operation.

## Record intent

Start `Context` with the triggering request verbatim. Apply the
self-contained task-intent invariant in
[`mdf-preserved-contract.md`](../../references/mdf-preserved-contract.md).

For a request that refers to earlier discussion, add `Resolved context` after
the triggering request only when material context is needed. Include each
labeled subsection only when it contains material context. Preserve only the
minimum with provenance: prior user statements verbatim, an agent proposal only
when the user explicitly accepted it, and any material task-language
interpretation. Do not add irrelevant transcript to a self-contained request:

```markdown
## Context

### Triggering request (verbatim)
> ...

### Resolved context

#### Prior user statements (verbatim)
> ...

#### Accepted agent proposal
- ...

#### Interpretation
- User term `...` means task term `...` because ...

### Intent
- Outcome: ...
- Success: ...
- Scope: ...
- Constraints: ...
- Non-goals: ...

### Decisions
- User-set: ...
- Delegated: ...
- Unresolved: ...

### Evidence
- ...
```

- Use the user's language where practical.
- Write `Not stated` or `Unresolved` instead of inventing intent, priority,
  dates, dependencies, non-goals, or implementation choices.
- Do not present an agent proposal or interpretation as user wording. Record an
  uncertain reference or terminology mapping in `Unresolved`, not as a silent
  normalization.
- Record design or work method only when the user selected it or delegated the
  choice.
- Keep analysis and agent proposals outside confirmed intent.
- Treat a generated title as navigation metadata.
- Preserve superseded intent when it explains the current request.
- Keep `Files`, `Criteria`, and `Log` headings. Use a bounded discovery scope
  when exact files are unknown; use criteria that reflect known outcomes.

Before saving, review the drafted card in isolation across standalone and
referential requests, including a choice among proposals, partial acceptance,
superseded intent, and terminology mapping; confirmed, delegated, and
unresolved intent must remain distinct.

Task creation does not require a complete specification, workflow readiness,
risk-category inventory, contract markers, digest, approval note, action
allowlist, or execution envelope. Unresolved facts may remain in a queued task.
Ask before creation only when contradictory input prevents a faithful record.

A task create or revise request authorizes that exact card mutation. Do not ask
the user to approve the card you just derived from the same request. A later
semantic revision requires a current user request or judgment already delegated
by the user; lifecycle metadata remains model-managed.

Creation never creates a branch, worktree, lock, commit, push, or PR.

## Mutate card and index

For every mutation:

1. Re-read and preserve the complete card and history.
2. Write one complete card first, changing only intended fields.
3. Append one complete projection containing `schema_version: 2`, `work_id`,
   `kind`, `task_id`, `title`, `status`, `order`, `item`, `latest`, and present
   worktree/branch fields.
4. Re-read the card and latest projection. If they differ, append one corrected
   projection only when the card makes the result unambiguous.

- Duplicate historical index rows are expected; the latest normalized row wins.
- Record progress, findings, failure, and abandonment in `Log` or a linked
  handoff while active.
- Notes and artifacts preserve evidence; they do not expand user intent or
  action authority.
- Keep `.mdf` state out of project commits.

## Activate and resume

`task <id> work` changes local lifecycle only. It does not decide whether any
consumer can implement, publish, or act externally.

1. Require a queued card and completed hard dependencies.
2. Load `using-git-worktrees` to prepare a clean isolated worktree and branch.
3. Require the lock target to be absent.
4. Acquire the lock exclusively with complete validated bytes using the narrow
   lock helper; never continue unlocked or overwrite a lock.
5. Write card `active`, append its projection, and re-read card, projection,
   lock, branch, and worktree.

### Bare work

When `task <id> work` is the only operation requested in the current user
message:

1. Report the task briefing after activation.
2. Stop.

A bare work invocation is terminal. Never infer implementation or another
operation from the task card, `Criteria`, active state, artifacts, briefing, or
prior conversation.

### Composed work

When the same current user message explicitly requests subsequent work:

1. Perform the same activation and verification.
2. Do not emit a standalone briefing.
3. Return the verified task, worktree, branch, and lock facts to the caller
   context.
4. Continue only with the explicitly requested operation.

Skipping the briefing never skips task, dependency, worktree, branch, lock, or
projection verification. Task activation does not authorize the later
operation.

Every lock records task ID, work ID, canonical root, worktree, branch, start
time, and runtime. It is ownership evidence, not authentication or action
authority. Reject mismatches. Never infer staleness from elapsed time; stale
takeover requires an explicit current request and byte-conditional
release/acquire after a full state recheck.

Hard dependencies are exact `depends_on` IDs. Each must be `done` without a
matching lock. Stop for stale, malformed, ambiguous, or contradictory evidence.

On resume, require the recorded active card and matching lock/worktree/branch.
Keep the same lifecycle state through recovery; do not invent a repair task or
status.

Use only `queue`, `active`, and `done`.

## Complete, drop, or hand off

### Complete

- Never mark a task `done` unless applicable completion criteria and evidence pass,
  and either the current user message explicitly invokes `task <id> done` or `github-after-merge` verifies the accepted revision merged.
- Never infer completion from criteria, artifacts, commits, PRs, checks, handoffs,
  workflow progress, or prior conversation; otherwise keep the task `active` and its lock held.
- Require a source commit when source changes are in scope; require none when
  the task explicitly permits no source changes.
- Write the card, append and re-read the projection, then release only the exact
  lock bytes with the narrow helper.
- Keep local completion distinct from push, PR, merge, publication, and cleanup.
- Delivery tasks complete only after `github-after-merge` verifies the accepted
  revision as merged.

### Drop

Treat the exact `task <id> drop` request as authority for that task only.
Revalidate identity, current state, deletion target, recovery, and tombstone;
stop for an active lock, ambiguous target, unrelated cleanup, or expanded
deletion. Preserve the index tombstone.

### Completed-task handoff

Use persisted branch/worktree facts for read-only review or handoff. Do not
mutate the card, replay `done`, or recreate a lock.

### Post-merge finalization

After `github-after-merge` independently verifies the exact merged revision:

- `active` with matching lock: card -> projection -> reread -> conditional
  release;
- `done` with matching lock: verify delivery evidence, repair one unambiguous
  projection if needed, reread, then release without replaying `done`;
- `done` without lock: verified no-op;
- every other combination: `BLOCKED`.

Cleanup occurs only after finalization and lock release.

## Authority and stop rules

- Task text records intent and evidence; it does not pre-authorize a consuming
  workflow or external action.
- An explicit invocation authorizes its named operation and ordinary in-scope
  steps. Do not request ceremonial reapproval for those steps.
- The skill performing an action owns its current target, state, permission,
  safety, verification, and rollback checks.
- Stop for a new user-owned decision, material scope expansion, an unrequested
  external action, destructive or irreversible work, or an unsafe/ambiguous
  target.
- Reject lock bypass, unsafe paths, unrelated staging, history deletion, force,
  merge, deploy, cleanup, or writes outside the canonical root/task-owned scope
  unless the current consuming invocation explicitly covers them.
- Stop for malformed state, duplicate IDs, lock conflicts, stale dependencies,
  unrelated dirt, failed required checks, provider uncertainty, or repeated
  no-progress.

## Completion check

- [ ] Exact canonical card, dependencies, branch, worktree, and lock verified.
- [ ] Card-first/index-append protocol re-read successfully.
- [ ] Required outcomes, evidence, tests, and source commit are present.
- [ ] Only task-owned paths changed or staged; `.mdf` remained local.
- [ ] External, destructive, completion, finalization, release, and cleanup
      boundaries were preserved.
