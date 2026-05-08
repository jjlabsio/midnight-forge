---
name: tasks
description: "Show and clean MDF task boards for the current project or all local projects stored under ~/.mdf/projects."
---

# tasks

Use this skill when the user invokes `$tasks` in Codex or `/mdf:tasks` in Claude Code.

This skill is LLM-driven. Do not use an MCP server, CLI helper, background runner, event store, or network service. Read local files directly.

## Storage

Current-project state lives under:

```text
~/.mdf/projects/{project-hash}/
```

Use the same project hash rules as the `task` skill:

1. `git remote get-url origin`
2. Absolute git root path from `git rev-parse --show-toplevel`
3. Absolute current working directory when not inside a git repository

The hash is the first 12 lowercase hex characters of SHA-256 over the selected source string.

Do not initialize storage for read-only board commands. If the current project has no MDF storage, show an empty board.

## Status Rules

Derive status on read:

1. `locks/{id}.lock` exists: `active`
2. Else task frontmatter has `completed`: `done`
3. Else: `queue`

If a task has both a lock and `completed`, display it as active and show a consistency warning. Do not delete the lock automatically.

Never require or write a `status` frontmatter field.

## Board Format

Group the current project board into:

- `Active`: tasks with lock files, showing ID, title, branch, worktree, runtime, and started time when available.
- `Queue`: tasks without locks or `completed`, sorted by `order` ascending. Show ID, title, due date when present, order, and created date.
- `Done`: tasks with `completed`, sorted by completion date descending. Show the most recent five tasks by default.

For malformed task files, show the path and parse problem under a warning section. Do not rewrite malformed files.

## Commands

### no args

Show the current project board. If storage is missing, show empty `Active`, `Queue`, and `Done` sections and report the expected storage path.

### `all`

Show all local project boards.

1. If `~/.mdf/projects` does not exist, report that no local MDF projects exist.
2. Scan `~/.mdf/projects/*/meta.json`.
3. For each valid project, read `tasks/` and `locks/`.
4. Group output by project name from `meta.json`, including project path.
5. Include Active, Queue, and recent Done summaries for each project.
6. Add a `Recommendation` section.

Recommendation chooses from all queue tasks:

1. Earliest due date first when due dates are present.
2. Then lowest `order`.
3. Then oldest `created`.

Show the recommended project name, task ID, title, due date when present, and project path. If no queue tasks exist, report that there is no recommended next task.

### `stale`

Review queue tasks in the current project whose `created` date is at least 30 days old.

1. List each stale task with ID, title, created date, and age in days.
2. Ask the user for each candidate whether to keep, delete, or skip.
3. Delete only when the user chooses delete for that task.
4. Do not delete active or done tasks.

### `clean`

Delete done tasks completed at least 7 days ago only after explicit confirmation.

1. List every done task in the current project with `completed` date at least 7 days old.
2. Show the exact task file paths that would be deleted.
3. Ask for explicit confirmation before deleting anything.
4. After confirmation, delete the listed task files and any matching lock files.
5. If there are no candidates, report that there is nothing to clean.

## Error Handling

Report clear errors for unknown subcommands, malformed `meta.json`, malformed task frontmatter, unreadable task files, and unreadable lock JSON. Continue rendering other valid tasks when one file is malformed.
