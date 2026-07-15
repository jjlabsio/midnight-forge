# Auto-workflow contracts

These readable contracts apply only when a caller establishes one of the
explicit internal modes below. They do not change standalone MDF or upstream
skill semantics.

A mode string alone grants no authority. The root must also carry a current
readable handoff containing the task/work IDs, worktree, branch, approved
spec/plan paths and hashes, lock ownership, completed slices, and allowed
actions. Every continuation re-reads the canonical card, lock, Git state, and
handoff. A matching task/worktree/branch lock is not an identity credential;
without current-session task context or an explicit task-specific
continuation request, stop instead of inferring ownership.

## Modes

### `mode: auto-workflow`

This is the local implementation mode. It authorizes the applicable MDF
spec/plan/build/test/review/simplification skills for one bounded run and the
task-owned local commits required by the implementation loop. It does not
authorize ship, task completion, push, PR creation/update, merge, deploy,
deletion, stale-lock takeover, force operations, or unrelated cleanup.

The local mode may keep the active task lock after a clean plan-slice commit so
the same task can be resumed. A plan-slice commit is not whole MDF task
completion.

### `mode: auto-workflow-pr`

This is the delivery mode formerly exposed as `auto-workflow`. It authorizes
the complete in-scope lifecycle plus push and GitHub PR create/update after
fresh preflight. It does not authorize merge, deploy, deletion, stale-lock
takeover, force operations, or unrelated cleanup.

## Intent preflight

At the beginning of either mode, read the upstream `interview-me` skill and
evaluate its `When to Use` conditions. Invoke it when:

- the ask is missing its user/target, purpose, success condition, or binding
  constraint;
- materially different interpretations are possible;
- an unsurfaced assumption is required;
- conflicting optimization goals have no user choice;
- confidence is below 95% for the next three answers; or
- the user explicitly requested an interview.

Do not invoke it for a clear, self-contained mechanical operation. Reuse a
settled handoff only while the intent and scope remain unchanged. If intent
requires an interview in a non-interactive run, stop rather than guessing.

## Handoff context

The root keeps a concise Markdown handoff note under the canonical work item.
It records settled intent, current phase, assumptions, applicable skills,
allowed actions, artifact paths, subagent reports, capability/fallback
decisions, completed plan slices, commit IDs, verification, and remaining
work. Downstream skills receive the note as bounded context and re-read the
actual task, Git, and artifact state before continuing.

This is model-led context, not a JSON protocol, script-enforced schema, hash
gate, or runtime authority verifier. A stale or conflicting note requires
reassessment from the actual state.

## Plan and task completion

The spec remains the complete requirements and acceptance baseline. The plan
identifies implementation slices. A plan-slice commit and evidence do not mark
the MDF task card `done` in local mode.

In PR mode, if pending plan slices exist, implement them using the local loop.
After each local slice, re-read the plan and card and repeat until no approved
plan slice remains. If none remain at the start, skip implementation rather
than inventing work, map every spec acceptance criterion to current
verification or review evidence, and continue to ship. After ship returns GO,
run the final PR preflight while the lock is still held; only then complete the
whole MDF task and release its lock immediately before the final push/PR
handoff.

Changed spec, plan, scope, task order, or code invalidates affected downstream
evidence. Do not infer completion from an artifact's existence, a green command,
a review phrase, or the absence of pending plan text alone.

## Subagents

Read-only exploration and review reports may be delegated through the central
dispatch policy. Subagents never write canonical `.mdf` state, advance task
lifecycle, push, or create PRs. The root synthesizes reports, owns shared
writes, and chooses serial execution whenever dependency, path, shared-state,
worktree, lock, or base-revision independence is uncertain.

## PR idempotency

In `mode: auto-workflow-pr`, before push or PR mutation recheck branch, remote,
clean diff, base mergeability, authentication, release language, and open-PR
state. Query open-PR state before push and again after push; query again before
retrying an uncertain create result. Update an existing open PR or create one
when none exists. After the PR URL or failure is recorded, stop; merge, deploy,
and cleanup remain separate actions.
