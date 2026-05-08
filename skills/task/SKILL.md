---
name: task
description: Manage one local MDF task lifecycle from any worktree: add, start, work, complete, reprioritize, annotate, or drop tasks stored under ~/.mdf/projects.
---

# task

Use this skill when the user invokes `$task` in Codex or `/mdf:task` in Claude Code.

This skill is LLM-driven. Do not use an MCP server, CLI helper, background runner, event store, or network service. Read and write files directly with the available local tools.

## Storage Model

All state lives outside git:

```text
~/.mdf/projects/{project-hash}/
```

Compute `{project-hash}` from the first available source:

1. `git remote get-url origin`
2. Absolute git root path from `git rev-parse --show-toplevel`
3. Absolute current working directory when not inside a git repository

The hash is the first 12 lowercase hex characters of SHA-256 over the selected source string.

Project storage layout:

```text
~/.mdf/projects/{project-hash}/
├── meta.json
├── counter.json
├── tasks/
└── locks/
```

Initialize this layout lazily for write commands. Do not create storage for read-only errors.

`meta.json`:

```json
{
  "name": "project-basename",
  "path": "/absolute/project/root",
  "remote": "git@github.com:user/project.git",
  "created": "2026-05-08T00:00:00Z"
}
```

Use the git root basename for `name`; if not in a git repository, use the current directory basename. Include `remote` when origin exists; otherwise set it to `null`. Use an ISO-8601 timestamp for `created`.

`counter.json`:

```json
{
  "next_id": 1
}
```

Task IDs are 3-digit zero-padded strings such as `"001"`.

Before creating a task, scan `tasks/[0-9][0-9][0-9].md` and find the largest existing ID. If `counter.json` is missing or malformed, or if its `next_id` is less than or equal to the largest existing ID, rewrite `counter.json` with `next_id` set to largest ID plus one. Never choose an ID that already has a matching `tasks/{id}.md`; do not overwrite an existing task file.

## Task File Format

Each task is `tasks/{id}.md`:

```markdown
---
id: "001"
title: "Short task title"
order: 1
created: 2026-05-08
due: 2026-05-10
completed: 2026-05-12
---

## Context

2-5 sentences of relevant conversation context.

## Files

- path/explicitly/mentioned.ts

## Criteria

- [ ] Criterion explicitly stated or clearly implied by the user

## Log

- 2026-05-08: Created task.
```

Required frontmatter fields are `id`, `title`, `order`, and `created`. Optional fields are `due` and `completed`. Never add a `status` field.

Always keep these English section headers, even when a section is empty:

```markdown
## Context

## Files

## Criteria

## Log
```

## Derived Status

Calculate status on read:

1. If `locks/{id}.lock` exists, status is `active`.
2. Else if frontmatter has `completed`, status is `done`.
3. Else status is `queue`.

If both a lock file and `completed` exist, display the task as `active` and show a consistency warning. Do not silently delete the lock.

## Lock Files

Starting work creates `locks/{id}.lock`:

```json
{
  "task_id": "001",
  "worktree": "/absolute/current/worktree",
  "branch": "task-system-design",
  "started": "2026-05-08T00:00:00Z",
  "runtime": "codex"
}
```

Do not require `pid`. Locks are ownership markers, not process liveness proofs.

When a lock already exists, show task ID, title, worktree, branch, runtime, and started time. Ask the user before takeover. If the user confirms takeover, replace the lock and append a dated log entry.

## Commands

### `add "description"`

Create a queued task.

1. Initialize project storage if needed.
2. Scan existing task filenames and repair `counter.json` if it is missing, malformed, or stale.
3. Read `next_id`; use it as the new 3-digit task ID only if `tasks/{id}.md` does not already exist. If the file exists, rescan existing IDs, repair `counter.json`, and choose the repaired `next_id` instead.
4. Set `order` to one greater than the current maximum order among queue tasks, or `1` if no queue tasks exist.
5. Generate a short title from the description.
6. Fill `Context` with a 2-5 sentence summary of relevant conversation.
7. Fill `Files` only with file paths explicitly mentioned in the conversation.
8. Fill `Criteria` only with checklist items explicitly stated or clearly implied. Leave it empty when criteria are not known.
9. Append `- YYYY-MM-DD: Created task.` to `Log`.
10. Write `tasks/{id}.md` without overwriting any existing task file, then update `counter.json` to `next_id + 1` in the same turn.
11. Report the created task ID, title, and file path.

### `add "description" --next`

Same as `add`, except set `order` to one less than the current minimum queue order, or `0` if no queue tasks exist.

### `add "description" --due DATE`

Same as `add`, and write a `due` frontmatter field. Parse dates with the current year when the user omits a year. If the date is invalid or ambiguous, ask for clarification before writing.

### `work {id}`

Start a specific task.

1. Require a task ID.
2. Load `tasks/{id}.md`; report a clear error if missing or malformed.
3. Reject done tasks.
4. If `locks/{id}.lock` exists, show lock details and ask whether to take over.
5. Create or replace `locks/{id}.lock` only after there is no lock or takeover is confirmed.
6. Read files listed in `## Files` when those paths exist relative to the current working directory.
7. Print a briefing with task title, status, context, file summaries, criteria, and recent log entries.

### `start`

Find queue tasks, sort by `order` ascending, choose the first task, and perform `work {id}`. If there are no queue tasks, report that the queue is empty.

### `done`

Complete the current active task.

1. Scan `locks/*.lock`.
2. If exactly one active task exists for the current project, complete it.
3. If none exist, ask for a task ID.
4. If multiple active tasks exist, list them and ask for a task ID.

Completion means adding `completed: YYYY-MM-DD` to frontmatter, appending `- YYYY-MM-DD: Completed task.` to `## Log`, and deleting `locks/{id}.lock` if it exists.

### `done {id}`

Complete the specified task using the same completion behavior as `done`.

### `bump {id}`

Move a queue task one position earlier. Reject active or done tasks. Swap its `order` with the nearest queue task that has a smaller order. If it is already first, report that no change is needed.

### `top {id}`

Move a queue task to the top. Reject active or done tasks. Set its `order` to one less than the current minimum queue order.

### `note {id} "message"`

Append a dated entry to `## Log`:

```markdown
- YYYY-MM-DD: message
```

Preserve frontmatter and all other sections.

### `drop {id}`

Delete a task only after explicit user confirmation.

1. Load the task title.
2. Show the task ID, title, and whether a matching lock exists.
3. Ask for confirmation before deleting.
4. After confirmation, delete `tasks/{id}.md` and `locks/{id}.lock` if present.

## Error Handling

Report clear errors for missing task ID, unknown subcommand, missing task file, malformed frontmatter, invalid due date, ambiguous due date, attempting `bump` or `top` on active or done tasks, and existing locks without takeover confirmation.
