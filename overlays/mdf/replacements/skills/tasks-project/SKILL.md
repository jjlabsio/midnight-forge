---
name: tasks-project
description: "Show and clean the current project's MDF task board."
---

# tasks-project

Render the current project's board directly from canonical Markdown cards,
derived index state, and lock files. Do not invoke a task-state CLI,
controller, background runner, or network service.

## Read the board

Resolve the canonical root by walking from the current path to the project
directory that owns .mdf/project/init.json; a linked worktree must use its
parent root. Require readable project init, .mdf/work/, .mdf/locks/, and
.mdf/index.jsonl. Do not initialize state here. Before rendering, run the
AI-led self-healing preflight: read cards and locks first, normalize known
legacy index rows, and automatically compact/rewrite only the derived index
when the authoritative state is unambiguous. This local metadata maintenance
is part of the board operation; it is not a separate repair command or
runtime migration.

Read each .mdf/work/*/item.md and its kind. For each work ID, the latest
normalized index projection is only a read cache, while the card remains
authoritative. Duplicate historical lines and malformed legacy index rows do
not block the board when cards and locks allow an unambiguous rebuild. Preserve
one recovery copy before an automatic rewrite. Malformed cards, duplicate task
IDs, conflicting current locks, or ambiguous tombstones remain warnings with
exact paths; skip only the affected item rather than guessing.

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
confirmation only, delete the listed directories and append current-version
index tombstones.
Never clean a lock-bearing item or context item. If authoritative state remains
ambiguous after the self-healing preflight, stop the affected cleanup rather
than infer a safe target.
