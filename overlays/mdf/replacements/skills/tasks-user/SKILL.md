---
name: tasks-user
description: "Show MDF task boards across registered local projects."
---

# tasks-user

Render boards across registered local projects from ~/.mdf/projects.json and
each canonical project's Markdown cards, derived index, and locks. Do not invoke a
task-state CLI, controller, background runner, or network service.

## Registry and project reads

Require valid user init, non-empty human language preferences, and a valid
~/.mdf/projects.json registry. Do not require the current directory to be a
project and do not initialize storage here.

For every registry entry, use its absolute canonical_root and read only:

    <canonical-root>/.mdf/project/init.json
    <canonical-root>/.mdf/index.jsonl
    <canonical-root>/.mdf/work/
    <canonical-root>/.mdf/locks/

For each project, run the AI-led self-healing preflight after reading cards and
locks. Normalize known legacy index rows and automatically compact/rewrite only
the derived index when the authoritative project state is unambiguous. This is
part of the board operation, not a separate repair command or runtime
migration; it never rewrites cards or project code. If one project is missing,
unreadable, uninitialized, or has ambiguous authoritative state, show a warning
for that project and continue with other valid projects. Do not infer a
different root.

## Status and rendering

Read item kind and card status, then reconcile task status with locks:

- matching lock: active
- no lock and status: "done": done
- otherwise: queue

The card is authoritative; the latest normalized index projection is a read
cache. Duplicate lines and malformed legacy index rows are historical input and
must not block an unambiguous board rebuild. Preserve one recovery copy before
an automatic rewrite. A lock on a queued or done card is a
consistency warning, never an automatic cleanup. Legacy cards without kind are
tasks. Tracks, notes, inbox, and routine items are context only.

Render each valid project with:

- Active tasks and their branch/worktree/runtime facts
- Queue sorted by due date, order, then created date
- Five most recent done tasks
- Tracks and context items separately
- Warnings with exact project and item paths
- A recommendation chosen only from executable queued tasks

Never recommend a track, note, inbox, or routine item as a next task. If no
queued executable task exists, say so even when context review prompts are due.
