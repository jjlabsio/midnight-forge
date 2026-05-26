# MDF Task System Design

> Historical note: this document describes the first-pass task storage model. Current MDF task and artifact storage is defined in `skills/task/SKILL.md` and uses canonical project-root `.mdf/` storage with `~/.mdf/projects.json` only as a project registry.

## Goal

Add a first-pass MDF task system using LLM-driven skills, not MCP tools, CLI helpers, or executable task-management code. The system should let a user add, inspect, prioritize, start, complete, annotate, and clean task files from any worktree while sharing task state through a single git-external storage location.

## Scope

This release adds the `task` and `tasks` skill surfaces plus Claude Code command shims. The actual task-management instructions live in `skills/task/SKILL.md` and `skills/tasks/SKILL.md`; `commands/task.md` and `commands/tasks.md` only read the matching skill file and follow it.

This release does not add an MCP server, CLI command, Node helper, Python package, event store, background runner, or automated process heartbeat. Those can be added later if the LLM-driven workflow proves useful and needs stronger guarantees.

## Naming

Skill names do not include an `mdf-` prefix.

- Codex skills: `$task`, `$tasks`
- Claude Code commands: `/mdf:task`, `/mdf:tasks`
- Skill directories: `skills/task/`, `skills/tasks/`
- Command shims: `commands/task.md`, `commands/tasks.md`

The existing `mdf-handshake` skill remains a legacy smoke-test surface and does not define the naming rule for new MDF skills.

## Storage

All task state is stored outside git under:

```text
~/.mdf/projects/{project-hash}/
```

The project hash is computed from:

1. `git remote get-url origin`, when it succeeds.
2. Otherwise, `git rev-parse --show-toplevel` resolved to an absolute path.

The identifier is the first 12 characters of the SHA-256 hex digest of that source string.

Project storage is lazily initialized on the first `/task add` or equivalent `$task add`:

```text
~/.mdf/
└── projects/
    └── {project-hash}/
        ├── meta.json
        ├── counter.json
        ├── tasks/
        └── locks/
```

`/tasks all` is read-only. If `~/.mdf/projects` does not exist, it reports an empty board instead of creating storage.

## Project Metadata

`meta.json` stores display and lookup information for cross-project boards:

```json
{
  "name": "midnight-forge",
  "path": "/absolute/project/root",
  "remote": "git@github.com:user/midnight-forge.git",
  "created": "2026-05-08T00:00:00Z"
}
```

Rules:

- `name` is the git root basename when inside a git repository.
- If not inside a git repository, `name` is the current directory basename.
- `path` is the project root at initialization time.
- `remote` is included when `origin` exists and omitted or set to `null` when it does not.
- `created` is an ISO-8601 timestamp.

## Counter

`counter.json` stores the next task number:

```json
{
  "next_id": 4
}
```

`/task add` reads `next_id`, creates `tasks/{id}.md`, then writes `next_id + 1`. IDs are 3-digit zero-padded strings such as `"001"`. Because the counter is global to the project hash outside git, all worktrees for the same project share the same sequence.

Since this first pass is LLM-driven, the skill must write the task file first and then update `counter.json` in the same turn. If a write is interrupted, the next invocation should scan existing task filenames and repair `counter.json` to one greater than the largest existing ID before creating a new task.

## Task File Format

Each task is a markdown file:

```text
~/.mdf/projects/{project-hash}/tasks/{id}.md
```

Frontmatter fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | 3-digit zero-padded ID, for example `"003"` |
| `title` | string | yes | Short task title generated from the description |
| `order` | number | yes | Lower numbers appear earlier in the queue |
| `created` | date | yes | Creation date |
| `due` | date | no | Optional due date |
| `completed` | date | no | Added when the task is done |

There is no `status` frontmatter field. Status is derived from lock and completion state.

Body sections are always present and always use English headings:

```markdown
## Context

## Files

## Criteria

## Log
```

Section content follows the existing `claude-crew` task behavior:

- `Context`: summarize relevant conversation context in 2-5 sentences.
- `Files`: list file paths explicitly mentioned in the conversation. Leave the section empty when none are known.
- `Criteria`: write checklist items only when completion criteria are explicitly stated or clearly implied. Leave the section empty when criteria are not known.
- `Log`: append dated lifecycle notes such as creation, manual notes, and completion.

## Derived Status

Task status is always calculated:

1. If `locks/{id}.lock` exists, status is `active`.
2. Else if `completed` exists in frontmatter, status is `done`.
3. Else status is `queue`.

If both a lock file and `completed` exist, display the task as `active` and show a consistency warning. The skill should not silently delete the lock in this case.

## Lock Files

Starting work creates:

```text
~/.mdf/projects/{project-hash}/locks/{id}.lock
```

Lock JSON:

```json
{
  "task_id": "003",
  "worktree": "/absolute/current/worktree",
  "branch": "task-system-design",
  "started": "2026-05-08T00:00:00Z",
  "runtime": "codex"
}
```

`pid` is not required in the LLM-driven first pass. If a future runtime can reliably provide `pid` and process start time, the lock format may be extended. For now, lock files are ownership markers, not process liveness proofs.

When `/task work {id}` sees an existing lock:

- Show the task ID, title, worktree, branch, runtime, and started time.
- Do not overwrite it automatically.
- Ask the user whether to take over the task.
- If the user confirms takeover, replace the lock and add a Log entry.

## `/task` Skill

`task` manages one task lifecycle. It supports:

| Command | Behavior |
| --- | --- |
| `add "description"` | Create a queue task from the description and current conversation context |
| `add "description" --next` | Insert at the top of the queue using `min(order) - 1` |
| `add "description" --due 5/10` | Parse due date using the current year unless a year is provided |
| `work {id}` | Create a lock and brief the task context |
| `start` | Start the queue task with the smallest order |
| `done` | Complete the current active task |
| `done {id}` | Complete a specific task |
| `bump {id}` | Swap order with the previous queue task |
| `top {id}` | Move a queue task to `min(order) - 1` |
| `note {id} "message"` | Append a dated Log entry |
| `drop {id}` | Delete a task only after explicit user confirmation |

Detailed behavior follows `claude-crew` with MDF-specific storage and derived status:

- `add` creates `tasks/{id}.md`, updates `counter.json`, and appends a creation Log entry.
- `work` reads the task, creates a lock, reads files listed in `## Files` when they exist, and prints a briefing with context, file summaries, criteria, and recent log entries.
- `start` selects the queue task with the smallest order and then performs `work`.
- `done` adds `completed`, appends a completion Log entry, and removes `locks/{id}.lock` if present.
- `bump` and `top` apply only to queue tasks. Active or done tasks are rejected.
- `note` preserves all task fields and appends only the requested dated note.
- `drop` shows the task title and asks for confirmation before deleting `tasks/{id}.md` and any matching lock.

## `/tasks` Skill

`tasks` shows and cleans boards. It supports:

| Command | Behavior |
| --- | --- |
| no args | Show the current project board |
| `all` | Show all project boards under `~/.mdf/projects` and recommend the next queue task |
| `stale` | Review queue tasks older than 30 days |
| `clean` | Delete done tasks completed at least 7 days ago, only after confirmation |

Board grouping:

- `Active`: tasks with lock files.
- `Queue`: tasks without locks or `completed`, sorted by `order` ascending.
- `Done`: tasks with `completed`, sorted by completion date descending, showing the most recent 5 in the default board.

`/tasks all` scans `~/.mdf/projects/*/meta.json` and each project's `tasks/` and `locks/` directories. It groups output by project name and includes a recommendation section. Recommendation chooses queue tasks first by due date urgency when present, then by `order`, then by `created`.

`/tasks stale` finds queue tasks whose `created` date is at least 30 days old. For each candidate, ask the user to keep, delete, or skip.

`/tasks clean` finds done tasks whose `completed` date is at least 7 days old. It prints the full candidate list and asks for explicit confirmation before deleting anything.

## Error Handling

Skills should report clear errors for:

- Missing task ID.
- Unknown subcommand.
- Missing task file.
- Malformed frontmatter.
- Invalid or ambiguous due date.
- Attempting `bump` or `top` on active or done tasks.
- Existing lock when starting work without takeover confirmation.

For malformed `counter.json`, recover by scanning existing task filenames and setting `next_id` to max existing ID plus one.

For malformed task files, do not rewrite the file automatically. Report the file path and the parse problem.

## Documentation

README should document:

- New task skill names.
- Claude and Codex invocation examples.
- The git-external storage location.
- The fact that task state is local-only and not pushed through git.
- The derived status model.

The existing `TASK-SYSTEM-DESIGN.md` remains the source design note for this worktree. The implementation plan should be based on this spec plus that source note.

## Acceptance Criteria

- `skills/task/SKILL.md` defines every `/task` subcommand listed above.
- `skills/tasks/SKILL.md` defines board, all, stale, and clean behavior.
- `commands/task.md` and `commands/tasks.md` delegate to the matching skill files.
- New task skills use prefix-free names.
- Task storage uses `~/.mdf/projects/{project-hash}` exactly.
- Task status is derived and no `status` frontmatter is introduced.
- `drop` and `clean` require user confirmation before deletion.
- README documents the task system entry points and local-only storage model.
