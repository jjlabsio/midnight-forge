---
name: github-pr-squash-merge
description: "Use when a user explicitly asks to publish a current validated branch as a new PR and squash-merge that exact PR after GitHub makes it ready."
---

# GitHub PR Squash Merge

## Scope and authority

This MDF-only delivery skill composes `github-pr` and `github-after-merge`.
It owns one new-PR-to-squash-merge sequence, current-thread observation, and
one guarded merge attempt. `github-pr` remains the sole publisher and
`github-after-merge` remains the sole merged-PR finalizer.

A direct user invocation authorizes this sequence. It does not authorize
auto-merge, an admin bypass, a merge queue, force operations, a deployment, or
reusing a PR that was already open when the invocation began.

## Invocation identity

| Invocation | Accepted identity | Required next operation |
| --- | --- | --- |
| Direct delivery | No PR identity from the caller. Record the invocation start, prove the current branch has no matching open PR, then **REQUIRED SUB-SKILL:** invoke `github-pr`. | Capture only the newly created PR returned by that publication. |
| Current-thread heartbeat | The root supplies the captured repository, PR number, base, head repository/branch, and head OID from this same direct delivery. | Observe that PR once; never invoke `github-pr` again. |

Reject a user-supplied PR number, URL, branch-name lookup, task-card link, or
remembered open PR. A task-linked run may use its `latest.pr` only to require
that `github-pr` persisted the same captured identity; it cannot use the link
as an input to begin or resume delivery.

## Direct delivery

1. Resolve the installed plugin root and load
   `<plugin-root>/references/mdf-preserved-contract.md`. Resolve the canonical
   root, active task when applicable, current clean non-default branch, origin,
   GitHub authentication, repository default base, and the exact current
   remote head. Record the invocation start. Query open PRs for the exact head
   repository and branch. Stop when one exists.
2. **REQUIRED SUB-SKILL:** invoke `github-pr`. It performs its own fresh
   preflight, commit/push/publication checks, and immutable task PR-link write.
   Do not reproduce those checks or mutate its title/body.
3. Capture the publication result only when it proves exactly one PR was
   created after the recorded invocation start, with the expected repository,
   default base, head repository/branch, and remote head OID. Stop if the
   result was an update, an existing PR, more than one PR, a different base or
   head, or an uncertain provider result. For an active task, require
   `task.json.latest.pr` to equal this captured `{ repository, number }`.
4. Create one Codex scheduled task in the current task as the heartbeat. Give
   it only the captured identity and task linkage. It performs the heartbeat
   below; it never finds another PR or republishes. Do not use a sleep loop,
   `gh pr checks --watch`, a polling script, persistent monitor state, or a
   new task field.

## Current-thread heartbeat

On each run, freshly observe only the captured PR. Require it to remain open
with the captured repository, default base, head repository/branch, and remote
head OID. Read its required checks (or, only when GitHub explicitly reports no
required checks, every related check), mergeability, conflicts, review/policy
state, and merge-queue state.

- If checks, approvals, mergeability, or provider policy are still pending,
  retain the heartbeat and report the current evidence without a merge.
- Stop and preserve the active task for a changed head or base, failed check,
  conflict, closed PR, missing approval, policy uncertainty, merge queue, or
  any identity mismatch. Do not schedule an automatic retry after a
  substantive stop.
- Only the all-green, immediately mergeable state enters the merge gate.

## Guarded squash-merge gate

Immediately before mutation, repeat the complete heartbeat observation and
require every fact to still match the captured PR and head. Require GitHub's
current policy to permit an immediate squash merge without a queue, bypass, or
auto-merge. If any fact is stale, pending, failed, changed, or uncertain, do
not merge.

Run exactly this merge form for the freshly revalidated head:

```bash
gh pr merge <number> --repo <owner/repository> --squash \
  --match-head-commit <head-oid> --delete-branch
```

Never omit `--match-head-commit`, substitute another merge strategy, enable
auto-merge, use an admin override, enqueue a merge queue, force-push, or retry
a failed merge. `--delete-branch` is the only remote-branch deletion request.

Re-read the captured PR after the command. Require that exact PR to be merged
to its captured default base. If GitHub confirms the merge but branch deletion
reports partial failure, retain that evidence and continue; otherwise a failed
or uncertain merge is a substantive stop.

## Finalization

After a confirmed merge, **REQUIRED SUB-SKILL:** invoke `github-after-merge`
with the captured repository and number. It verifies the merged PR and final
head checks, completes a matching active task, synchronizes eligible default
branch worktrees, and runs its existing cleanup contract. Do not duplicate its
task transition or cleanup logic.

Report the captured PR URL and identity, every heartbeat/merge-gate fact, the
guarded command result, branch-deletion result, and finalizer result. Keep
task state active whenever publication, observation, merge, or finalization
stops before its documented completion.
