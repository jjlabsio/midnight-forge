---
name: tasks-project
description: "Show and clean the current project's MDF task board."
---

# tasks-project

Use this skill when the user invokes `$tasks-project` in Codex.

This skill is LLM-orchestrated. From the plugin root, use the deterministic local script `scripts/mdf-task-state.js board --project --json` for mechanical current-project board state when available, then render the human-facing board from that JSON. Do not use an MCP server, background runner, event store, or network service.

The LLM remains responsible for concise presentation, warnings, cleanup confirmation prompts, and judgment-heavy stale/clean decisions. If the script returns a typed JSON error, report it clearly and stop unless this skill explicitly permits continuing around a malformed item.

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

Before reading current-project MDF task board state, verify MDF init state:

1. User init exists at `~/.mdf/user/init.json`.
2. `~/.mdf/user/preferences.json` exists and has a non-empty `human_language`.
3. Project init exists at `<canonical-root>/.mdf/project/init.json`.

If init state is missing or malformed, stop before reading MDF board state and instruct the user to run `mdf init`. Do not auto-initialize from this skill.

Do not initialize storage for read-only board commands.

## Status Rules

Read `kind` from `.mdf/work/{work_id}/item.md` before deriving board status. Existing legacy item cards without `kind` are treated as `kind: "task"`.

For `kind: "task"`, read status from the item card and reconcile it with locks:

1. `.mdf/locks/{task_id}.lock` exists: display as `active`.
2. Else item frontmatter has `status: "done"` or `completed`: display as `done`.
3. Else display as `queue`.

If an item has both a lock and `status: "done"` or `completed`, display it as active and show a consistency warning. Do not delete the lock automatically.

Do not derive `active`, `queue`, or `done` for `kind: "inbox"`, `kind: "routine"`, or `kind: "track"`. These kinds are non-executable context. They must not appear in the task `Active`, `Queue`, or `Done` sections unless they are malformed legacy cards that cannot be classified.

## Board Format

Group the current project board into:

- `Active`: task items with lock files, showing ID, title, optional `[track: Track title]`, branch, worktree, runtime, and started time when available.
- `Queue`: queued task items, sorted by `order` ascending. Show task ID, work ID, title, optional `[track: Track title]`, due date when present, order, and created date.
- `Done`: completed task items, sorted by completion date descending. Show the most recent five tasks by default.
- `Tracks`: track items, showing track ID, title, outcome when present, active/queued/done task counts, inbox count, routine count, and the next ready executable task in that track when one exists.
- `Inbox`: inbox items, showing item ID, title, optional `[track: Track title]`, created date, and a short context summary when available.
- `Routine Review Prompts`: routine items whose `next_review` is today or earlier, showing item ID, title, optional `[track: Track title]`, cadence, next review date, and `review_prompt` when present. Present these as review prompts, not executable tasks; the user may review, promote, or create a concrete task if real work is found.

For malformed item files, show the path and parse problem under a warning section. Do not rewrite malformed files.

Resolve track labels by scanning `kind: "track"` item cards. Task, inbox, and routine `track_id` frontmatter is authoritative for membership. A track's optional `members` list is only display/helping metadata and may be incomplete. If an item has an unresolved `track_id`, keep rendering the item and add a warning for the unresolved track reference.

## Commands

### no args

Show the current project board. If storage is missing, show empty `Active`, `Queue`, and `Done` sections and report the expected storage path.

### `stale`

Review queued task items in the current project whose `created` date is at least 30 days old or whose `expires` date has passed.

1. List each stale task with ID, title, created date, and age in days.
2. Ask the user for each candidate whether to keep, delete, or skip.
3. Delete only when the user chooses delete for that task.
4. Do not delete active or done tasks.
5. Do not include `inbox`, `routine`, or `track` items in task staleness cleanup. They may be shown separately as old context, but deleting or archiving non-task items requires an explicit future command or explicit user instruction.

### `clean`

Delete done task items completed at least 7 days ago, or expired task items whose `expires` date has passed, only after explicit confirmation.

1. Find work items in the current project with `completed` date at least 7 days old or expired `expires`.
2. Exclude any work item that also has `.mdf/locks/{task_id}.lock`; because lock plus completed derives to active, report it as a consistency issue and skip it.
3. List every remaining cleanup candidate.
4. Show the exact `.mdf/work/{work_id}/` paths that would be deleted.
5. Ask for explicit confirmation before deleting anything.
6. After confirmation, delete only the listed work item directories and append tombstone entries to `.mdf/index.jsonl`.
7. If there are no valid cleanup candidates, report that there is nothing to clean.
8. Do not clean `inbox`, `routine`, or `track` items by task completion rules.

## Error Handling

Report clear errors for unknown subcommands, malformed `project.json`, malformed `index.jsonl`, malformed item frontmatter, unreadable item files, and unreadable lock JSON. Continue rendering other valid tasks when one file is malformed.
