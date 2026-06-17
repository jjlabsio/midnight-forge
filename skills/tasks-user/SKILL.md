---
name: tasks-user
description: "Show MDF task boards across registered local projects."
---

# tasks-user

Use this skill when the user invokes `$tasks-user` in Codex or `/mdf:tasks-user` in Claude Code.

This skill is LLM-driven. Do not use an MCP server, CLI helper, background runner, event store, or network service. Read local files directly.

## Storage

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

For each registered project, project task state is read from:

```text
<canonical-root>/.mdf/
├── project.json
├── project/init.json
├── index.jsonl
├── work/
└── locks/
```

## Init Requirements

Before reading user-level MDF task board state, verify only global user state:

1. User init exists at `~/.mdf/user/init.json`.
2. `~/.mdf/user/preferences.json` exists and has a non-empty `human_language`.
3. `~/.mdf/projects.json` exists and matches the registry schema above.

Malformed or missing user init, user preferences, or global registry state is a hard error. Stop and report the registry or user-state problem clearly; do not guess another shape.

Do not require the current working directory to be inside a git repository. Do not resolve a canonical root from the current directory. `tasks-user` does not require current project init merely because the user invoked it from a non-project directory. After `mdf init` has completed User Init from any directory, `tasks-user` can run from anywhere as long as `~/.mdf/projects.json` is valid.

Do not initialize storage for read-only board commands.

## Per-Project Handling

Read project entries from `projects`, keyed by `canonical_root`. For each registered project, treat project MDF state as optional per-entry data:

1. If the canonical root path is missing, unreadable, or not a directory, show a warning for that project and skip it.
2. If `<canonical-root>/.mdf/project/init.json` is missing, show a warning that the project is not initialized and skip it.
3. If `<canonical-root>/.mdf/index.jsonl`, `<canonical-root>/.mdf/work/`, or `<canonical-root>/.mdf/locks/` is missing or unreadable, show a warning and skip that project.
4. If `project.json`, `index.jsonl`, lock JSON, or item frontmatter is malformed for one project, show a warning for that project and skip only the malformed project or malformed item as narrowly as possible.
5. Continue rendering all other valid projects.

Do not abort the entire user-level board because one registered project store is missing, uninitialized, unreadable, or malformed. Hard-stop only for malformed global registry or user state.

## Status Rules

For each valid project, read status from `.mdf/work/{work_id}/item.md` and reconcile it with locks:

1. `.mdf/locks/{task_id}.lock` exists: display as `active`.
2. Else item frontmatter has `status: "done"` or `completed`: display as `done`.
3. Else display as `queue`.

If an item has both a lock and `status: "done"` or `completed`, display it as active and show a consistency warning. Do not delete the lock automatically.

## Board Format

Group output by project name from the registry or `.mdf/project.json`, including canonical root path.

For each valid project, include:

- `Active`: tasks with lock files, showing ID, title, branch, worktree, runtime, and started time when available.
- `Queue`: work items without locks or completion state, sorted by `order` ascending. Show task ID, work ID, title, due date when present, order, and created date.
- `Done`: work items with completion state, sorted by completion date descending. Show the most recent five tasks by default.

Include a `Warnings` section for skipped projects and malformed items.

Add a `Recommendation` section.

Recommendation chooses from all queue tasks across valid projects:

1. Earliest due date first when due dates are present.
2. Then lowest `order`.
3. Then oldest `created`.

Show the recommended project name, task ID, work ID, title, due date when present, and canonical root path. If no queue tasks exist, report that there is no recommended next task.

## Commands

### no args

Show all local project boards from the user registry.

## Error Handling

Report clear hard errors for missing or malformed user init, missing or malformed user preferences, missing or malformed `~/.mdf/projects.json`, unknown subcommands, and registry entries that do not match the required schema.

Report warnings and continue for missing project roots, uninitialized project stores, unreadable project files, malformed per-project `project.json`, malformed per-project `index.jsonl`, malformed item frontmatter, unreadable item files, and unreadable lock JSON.
