---
name: github-pr
description: "Use when creating or updating a GitHub pull request for MDF work, including a read-only handoff for an already-completed task."
---

# GitHub PR

When called with `mode: auto-workflow-pr`, load
`../../references/auto-workflow-contract.md`. Its run-scoped authority permits
only the final push and PR create/update mutation after fresh preflight. A
bare mode string is not authority; require the current handoff, matching
task/lock/worktree/branch facts, approved artifact hashes, and fresh preflight.

This skill completes an incomplete current-session task or validates handoff
for an already-completed task. It has two handoff paths and is model-led. Use
local Git state, the GitHub CLI, and the connected GitHub surface when
available; do not use a background workflow runner or a
machine-readable helper contract. GitHub is the source of truth for PR state,
and PR reports do not belong in `.mdf/`.

The skill has two task handoff paths. An incomplete task is active and is
completed before PR creation. An already-completed task is validated for
read-only handoff without repeating completion. The latter path never
recreates, replaces, or deletes a lock and never mutates the task card.

## Review provenance boundary

Completed-task review is read-only. The strict active-lock resolver governs
writes for active work; a completed-task review does not recreate a lock. The
readable review scope labels are `lifecycle-review` for a full approved-tree
review and `task-review` for exact task/diff/verification context. The
`review_mode` label is descriptive only: lifecycle and ship consumers accept
only `lifecycle-review`, while `task-review` remains standalone and cannot
create lifecycle evidence or satisfy ship.

## Handoff and preflight

1. Identify exactly one session task from the user's task ID, the worktree or
   branch reported in this session, or the current task description. Stop if
   the session identifies zero or multiple task IDs.
2. Resolve the canonical root and find the unique matching
   `.mdf/work/*/item.md`. Stop on missing, duplicate, unreadable, or malformed
   cards.
3. For an incomplete task, require `status: "active"` and a matching lock with
   task and work IDs. For an already-completed task, require persisted
   `worktree` and `branch` fields that match the current checkout; this path
   does not require a lock. A completed task with a matching lock is a
   consistency stop, and do not call `task done` for it.
4. Check the current worktree, branch, `git status --short`, origin remote,
   GitHub authentication, and default branch. Never prepare a PR from the
   default branch or unrelated dirty work.
5. Fetch the remote base and run a mergeability preflight. If it fails, report
   the conflicting paths and stop before task completion, push, or PR change.
6. If the incomplete task is valid, use the task skill's normal `done` behavior
   with the readable message `Completed task before PR creation.` Do not edit
   the card directly. If already completed, report that its read-only handoff
   validation passed.

Callers pass only user-confirmed intent, or the explicit
`mode: auto-workflow-pr` run authorization, plus current session context; never
pass asserted Git/GitHub facts. Preserve raw command outputs in the readable
preflight report. If uncommitted changes remain, use `github-commit` and
recheck the clean tree before continuing. Stage only intended paths; do not
use a PR as a commit gate.

## PR language and content

Read `~/.mdf/user/preferences.json` when present and use its non-empty
`human_language` for human-facing prose. If it is missing or malformed, state
that English fallback was selected. Keep headings, commands, paths, labels,
identifiers, task IDs, and repository conventions unchanged.

Summarize all branch commits, changed files, verification commands and
outcomes, release signal, operational impact, rollback, and the completed task
ID when applicable. Use the repository PR template and a Conventional Commit
title. Run an external operations scan for environment variables, secrets,
integrations, webhooks, queues, DNS, flags, migrations, data backfills,
certificates, credentials, and manual rollback steps. Include a truthful test
plan even when a check was not run.

## External authority

Release selection and all external mutations remain authoritative in this
skill. Before pushing or creating/updating the PR, recheck the current branch,
remote, diff, language, release signal, authentication, mergeability, and
open-PR status. Keep the PR ready for review unless the user explicitly
requested a draft. In standalone mode, an explicit current-session invocation
of this skill authorizes push and PR create/update after the fresh preflight;
do not ask for a second confirmation. In `mode: auto-workflow-pr`, the initial
run-scoped invocation likewise allows only push and PR create/update after the
fresh preflight described above. A bare mode string without that readable
context follows the standalone rule. Do not merge, deploy, delete branches,
delete worktrees, or discard dirty worktrees as a side effect.

GitHub is the source of truth for whether an open PR already exists. Push the
current branch, check for an existing open PR, update it when its
intended title/body changed, or create one with `gh pr create` when none exists.
Do not create a duplicate. After reporting the PR URL or failure, stop; review,
CI, merge, default-branch sync, and cleanup happen in later skills.

## Stop conditions

Stop for a missing or ambiguous session task, malformed task state, lock or
worktree mismatch, default branch, dirty unrelated changes, missing origin or
GitHub authentication, unmergeable base, unclear release signal, wrong PR
language, failed push, failed PR command, duplicate/uncertain PR state, or an
external action outside the auto-workflow-pr authority.
