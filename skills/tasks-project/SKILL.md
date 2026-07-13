---
name: tasks-project
description: "Show and clean the current project's MDF task board."
---

# tasks-project

Render the current project's board directly from canonical Markdown cards,
append-only index state, and lock files. Do not invoke a task-state CLI,
controller, background runner, or network service.

## Read the board

Resolve the canonical root by walking from the current path to the project
directory that owns .mdf/project/init.json; a linked worktree must use its
parent root. Require readable project init, .mdf/work/, .mdf/locks/, and
.mdf/index.jsonl. Do not initialize or repair state for a read-only board.

Read each .mdf/work/*/item.md and its kind. For each work ID, the latest valid
index.jsonl line is the read projection, but the card remains authoritative.
Duplicate lines are history. Malformed cards, JSON, or locks are warnings with
exact paths; do not rewrite them.

For executable task cards, reconcile status as follows:

- a matching lock displays as active
- otherwise status: "done" displays as done
- otherwise it displays as queue

If a lock exists for a queued or done card, show a consistency warning and do
not delete the lock. Legacy cards without kind are tasks. Tracks, notes, inbox,
and routine cards are context, not executable task rows.

Render:

- Active: task ID, title, branch, worktree, runtime, and started time
- Queue: task ID, work ID, title, order, due date, and created date
- Done: the five most recently completed tasks
- Tracks and context items separately, with unresolved membership warnings
- Warnings for malformed or conflicting state

Sort queued tasks by due date when present, then order, then created date.

## stale

List queued tasks older than 30 days or past expires. Ask separately whether to
keep, delete, or skip each. Never delete active or done tasks, context items,
or anything with a lock.

## clean

Find done or expired tasks eligible for cleanup, show every exact
.mdf/work/{work_id}/ directory, and ask for explicit confirmation. After
confirmation only, delete the listed directories and append index tombstones.
Never clean a lock-bearing item or context item. If state is malformed, stop
the affected cleanup rather than infer a safe target.
