---
name: tasks
description: "Show and clean MDF task boards for the current project or all registered local projects."
---

# tasks

Use this skill when the user invokes `$tasks` in Codex or `/mdf:tasks` in Claude Code.

This skill is LLM-driven. Do not use an MCP server, CLI helper, background runner, event store, or network service. Read local files directly.

## Storage

Current-project state lives under the canonical project root:

```text
<canonical-root>/.mdf/
├── project.json
├── project/init.json
├── index.jsonl
├── work/
└── locks/
```

Resolve the canonical project root using the same rules as the `task` skill:

1. If the current checkout path is under `<root>/.worktrees/<branch>`, use `<root>`.
2. Otherwise use `git rev-parse --show-toplevel`.
3. If not inside a git repository, use the absolute current working directory.

Global discovery uses:

```text
~/.mdf/projects.json
```

Each registry entry should include the project name, canonical root path, remote when known, and the relative task index path `.mdf/index.jsonl`.

The registry file must use this schema:

```json
{
  "version": 1,
  "projects": {
    "/absolute/project/root": {
      "id": "1d55c7f13adf",
      "name": "project-basename",
      "canonical_root": "/absolute/project/root",
      "remote": "git@github.com:user/project.git",
      "index": ".mdf/index.jsonl",
      "last_seen": "2026-05-08T00:00:00Z"
    }
  }
}
```

Before reading MDF task board state, verify MDF init state:

1. User init exists at `~/.mdf/user/init.json`.
2. `~/.mdf/user/preferences.json` exists and has a non-empty `human_language`.
3. Project init exists at `<canonical-root>/.mdf/project/init.json` for current-project board commands.

If init state is missing or malformed, stop before reading MDF board state and instruct the user to run `mdf init`. Do not auto-initialize from this skill.

Read project entries from `projects`, keyed by `canonical_root`. If `~/.mdf/projects.json` exists but is malformed or does not match this schema, report a clear registry error and do not guess another shape.

Do not initialize storage for read-only board commands.

## Status Rules

Read status from `.mdf/work/{work_id}/item.md` and reconcile it with locks:

1. `.mdf/locks/{task_id}.lock` exists: display as `active`.
2. Else item frontmatter has `status: "done"` or `completed`: display as `done`.
3. Else display as `queue`.

If an item has both a lock and `status: "done"` or `completed`, display it as active and show a consistency warning. Do not delete the lock automatically.

## Board Format

Group the current project board into:

- `Active`: tasks with lock files, showing ID, title, branch, worktree, runtime, and started time when available.
- `Queue`: work items without locks or completion state, sorted by `order` ascending. Show task ID, work ID, title, due date when present, order, and created date.
- `Done`: work items with completion state, sorted by completion date descending. Show the most recent five tasks by default.

For malformed item files, show the path and parse problem under a warning section. Do not rewrite malformed files.

## Commands

### no args

Show the current project board. If storage is missing, show empty `Active`, `Queue`, and `Done` sections and report the expected storage path.

### `all`

Show all local project boards.

1. If `~/.mdf/user/init.json`, `~/.mdf/user/preferences.json`, or `~/.mdf/projects.json` does not exist, stop and instruct the user to run `mdf init`.
2. Read each entry in `projects` and resolve its canonical root.
3. For each valid project, read `.mdf/index.jsonl`, `.mdf/work/*/item.md` when needed, and `.mdf/locks/`.
4. Group output by project name from the registry or `.mdf/project.json`, including canonical root path.
5. Include Active, Queue, and recent Done summaries for each project.
6. Add a `Recommendation` section.

Recommendation chooses from all queue tasks:

1. Earliest due date first when due dates are present.
2. Then lowest `order`.
3. Then oldest `created`.

Show the recommended project name, task ID, work ID, title, due date when present, and canonical root path. If no queue tasks exist, report that there is no recommended next task.

### `stale`

Review queue work items in the current project whose `created` date is at least 30 days old or whose `expires` date has passed.

1. List each stale task with ID, title, created date, and age in days.
2. Ask the user for each candidate whether to keep, delete, or skip.
3. Delete only when the user chooses delete for that task.
4. Do not delete active or done tasks.

### `clean`

Delete done work items completed at least 7 days ago, or expired work items whose `expires` date has passed, only after explicit confirmation.

1. Find work items in the current project with `completed` date at least 7 days old or expired `expires`.
2. Exclude any work item that also has `.mdf/locks/{task_id}.lock`; because lock plus completed derives to active, report it as a consistency issue and skip it.
3. List every remaining cleanup candidate.
4. Show the exact `.mdf/work/{work_id}/` paths that would be deleted.
5. Ask for explicit confirmation before deleting anything.
6. After confirmation, delete only the listed work item directories and append tombstone entries to `.mdf/index.jsonl`.
7. If there are no valid cleanup candidates, report that there is nothing to clean.

## Error Handling

Report clear errors for unknown subcommands, malformed `project.json`, malformed `index.jsonl`, malformed item frontmatter, unreadable item files, and unreadable lock JSON. Continue rendering other valid tasks when one file is malformed.
