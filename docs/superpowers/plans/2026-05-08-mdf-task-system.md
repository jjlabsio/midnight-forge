# MDF Task System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-pass MDF task management through LLM-driven `task` and `tasks` skills plus Claude Code command shims.

**Architecture:** The implementation is documentation-first: runtime behavior lives in `skills/task/SKILL.md` and `skills/tasks/SKILL.md`, while `commands/task.md` and `commands/tasks.md` only delegate to those skills. No MCP server, CLI helper, event store, background runner, or executable task-management package is introduced; agents directly read and write `~/.mdf/projects/{project-hash}` according to skill instructions.

**Tech Stack:** Markdown `SKILL.md` files, Claude Code command shim Markdown files, README documentation, shell-based repository verification with `rg`, `find`, and `git diff`.

---

## File Structure

- Create `skills/task/SKILL.md`: Defines the prefix-free `task` skill for single-task lifecycle commands: `add`, `work`, `start`, `done`, `bump`, `top`, `note`, and `drop`.
- Create `skills/tasks/SKILL.md`: Defines the prefix-free `tasks` skill for project and cross-project boards: default board, `all`, `stale`, and `clean`.
- Create `commands/task.md`: Claude Code command shim for `/mdf:task`; it reads `${CLAUDE_PLUGIN_ROOT}/skills/task/SKILL.md` and follows it.
- Create `commands/tasks.md`: Claude Code command shim for `/mdf:tasks`; it reads `${CLAUDE_PLUGIN_ROOT}/skills/tasks/SKILL.md` and follows it.
- Modify `README.md`: Documents the new task system entry points, local-only storage, derived status model, and examples for Claude Code and Codex.
- Do not modify `.codex-plugin/plugin.json` or `.claude-plugin/plugin.json`: both already point at `./skills/`, so new skill directories are discovered without manifest changes.
- Do not modify `skills/mdf-handshake/SKILL.md` or `commands/mdf-handshake.md`: handshake remains a legacy smoke-test surface with the old prefixed name.

## Implementation Tasks

### Task 1: Add the `task` Skill

**Files:**
- Create: `skills/task/SKILL.md`
- Verify: `docs/superpowers/specs/2026-05-08-mdf-task-system-design.md`

- [ ] **Step 1: Read the skill-writing guidance before creating the skill**

Run:

```bash
sed -n '1,240p' /Users/jaejinsong/.codex/plugins/cache/openai-curated/superpowers/f812c146/skills/writing-skills/SKILL.md
```

Expected: Output includes the skill-writing workflow. Apply the relevant rules while writing `skills/task/SKILL.md`: concise frontmatter, imperative workflow instructions, and concrete verification.

- [ ] **Step 2: Create `skills/task/SKILL.md`**

Create the file with this exact structure and content, preserving the command names and storage paths:

```markdown
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

If `counter.json` is missing or malformed, scan `tasks/[0-9][0-9][0-9].md`, find the largest existing ID, and rewrite `counter.json` with `next_id` set to largest ID plus one before creating a task.

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
2. Repair `counter.json` if needed.
3. Read `next_id`; use it as the new 3-digit task ID.
4. Set `order` to one greater than the current maximum order among queue tasks, or `1` if no queue tasks exist.
5. Generate a short title from the description.
6. Fill `Context` with a 2-5 sentence summary of relevant conversation.
7. Fill `Files` only with file paths explicitly mentioned in the conversation.
8. Fill `Criteria` only with checklist items explicitly stated or clearly implied. Leave it empty when criteria are not known.
9. Append `- YYYY-MM-DD: Created task.` to `Log`.
10. Write `tasks/{id}.md`, then update `counter.json` to `next_id + 1` in the same turn.
11. Report the created task ID, title, and file path.

### `add "description" --next`

Same as `add`, except set `order` to one less than the current minimum queue order, or `0` if no queue tasks exist.

### `add "description" --due DATE`

Same as `add`, and write a `due` frontmatter field. Parse dates with the current year when the user omits a year. If the date is invalid or ambiguous, ask for clarification before writing.

### `work {id}`

Start a specific task.

1. Require a task ID.
2. Load `tasks/{id}.md`; report a clear error if missing or malformed.
3. Reject done tasks unless the user explicitly asks to reopen in a later instruction.
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
```

- [ ] **Step 3: Verify `task` skill defines every required subcommand**

Run:

```bash
rg '### `(add "description"|add "description" --next|add "description" --due DATE|work \\{id\\}|start|done|done \\{id\\}|bump \\{id\\}|top \\{id\\}|note \\{id\\} "message"|drop \\{id\\})`' skills/task/SKILL.md
```

Expected: Output includes all eleven command headings.

- [ ] **Step 4: Verify the `task` skill does not introduce status frontmatter**

Run:

```bash
rg 'status:' skills/task/SKILL.md
```

Expected: No output and exit code `1`.

- [ ] **Step 5: Commit the `task` skill**

Run:

```bash
git add skills/task/SKILL.md
git commit -m "feat: add mdf task skill"
```

Expected: Commit succeeds with one new file.

### Task 2: Add the `tasks` Board Skill

**Files:**
- Create: `skills/tasks/SKILL.md`
- Verify: `docs/superpowers/specs/2026-05-08-mdf-task-system-design.md`

- [ ] **Step 1: Create `skills/tasks/SKILL.md`**

Create the file with this exact structure and content:

```markdown
---
name: tasks
description: Show and clean MDF task boards for the current project or all local projects stored under ~/.mdf/projects.
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
```

- [ ] **Step 2: Verify board commands are present**

Run:

```bash
rg '### (no args|`all`|`stale`|`clean`)' skills/tasks/SKILL.md
```

Expected: Output includes four command headings.

- [ ] **Step 3: Verify cleanup commands require confirmation**

Run:

```bash
rg 'confirmation|keep, delete, or skip|Delete only when' skills/tasks/SKILL.md
```

Expected: Output includes confirmation requirements for `stale` and `clean`.

- [ ] **Step 4: Verify no status frontmatter is introduced**

Run:

```bash
rg 'status:' skills/tasks/SKILL.md
```

Expected: No output and exit code `1`.

- [ ] **Step 5: Commit the `tasks` skill**

Run:

```bash
git add skills/tasks/SKILL.md
git commit -m "feat: add mdf tasks board skill"
```

Expected: Commit succeeds with one new file.

### Task 3: Add Claude Code Command Shims

**Files:**
- Create: `commands/task.md`
- Create: `commands/tasks.md`

- [ ] **Step 1: Create `commands/task.md`**

Create:

```markdown
---
description: "Manage one MDF task lifecycle"
---

Read the file at `${CLAUDE_PLUGIN_ROOT}/skills/task/SKILL.md` using the Read tool and follow its instructions exactly.
```

- [ ] **Step 2: Create `commands/tasks.md`**

Create:

```markdown
---
description: "Show and clean MDF task boards"
---

Read the file at `${CLAUDE_PLUGIN_ROOT}/skills/tasks/SKILL.md` using the Read tool and follow its instructions exactly.
```

- [ ] **Step 3: Verify shims point to prefix-free skill directories**

Run:

```bash
rg 'skills/(task|tasks)/SKILL.md' commands/task.md commands/tasks.md
```

Expected: Output shows one match in `commands/task.md` and one match in `commands/tasks.md`.

- [ ] **Step 4: Verify no new `mdf-` prefixed command files were created**

Run:

```bash
find commands -maxdepth 1 -type f -name 'mdf-task*.md' -print
```

Expected: No output.

- [ ] **Step 5: Commit the command shims**

Run:

```bash
git add commands/task.md commands/tasks.md
git commit -m "feat: add mdf task command shims"
```

Expected: Commit succeeds with two new files.

### Task 4: Document the Task System in README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the v1 scope wording**

In `README.md`, change the `v1 Scope` list item:

```markdown
- Included skill: `mdf-handshake`
```

to:

```markdown
- Included skills: `mdf-handshake`, `task`, `tasks`
```

- [ ] **Step 2: Add task invocation examples after Codex install examples**

After the existing Codex handshake invocation block, add:

```markdown
Invoke the task skills through Codex:

```text
$task add "Write the release checklist"
$task start
$tasks
$tasks all
```
```

- [ ] **Step 3: Add Claude Code task invocation examples after the Claude handshake block**

After the existing Claude Code handshake invocation block, add:

```markdown
Invoke the task skills through Claude Code:

```text
/mdf:task add "Write the release checklist"
/mdf:task start
/mdf:tasks
/mdf:tasks all
```
```

- [ ] **Step 4: Add the task system documentation section before `## Local Smoke Tests`**

Insert:

```markdown
## Task System

Midnight Forge includes a first-pass local task system built from LLM-driven skills:

- Codex: `$task`, `$tasks`
- Claude Code: `/mdf:task`, `/mdf:tasks`

Task state is local-only and git-external:

```text
~/.mdf/projects/{project-hash}/
```

The project hash is based on `git remote get-url origin` when available, otherwise the absolute project root path. Because task state is outside git, it is shared across worktrees on the same machine but is not committed, pushed, or shared with teammates through PRs.

Each task is a Markdown file with YAML frontmatter plus these fixed English body sections:

```markdown
## Context

## Files

## Criteria

## Log
```

Task status is derived instead of stored:

- `locks/{id}.lock` exists: active
- Otherwise `completed` exists in frontmatter: done
- Otherwise: queue

Task files must not use a `status` frontmatter field. `drop` and `clean` require explicit confirmation before deleting task files.
```

- [ ] **Step 5: Verify README mentions the required concepts**

Run:

```bash
rg '(\$task|\$tasks|/mdf:task|/mdf:tasks|~/.mdf/projects|local-only|git-external|status frontmatter|explicit confirmation)' README.md
```

Expected: Output includes matches for Codex entry points, Claude entry points, storage path, local-only storage, derived status, and deletion confirmation.

- [ ] **Step 6: Commit README changes**

Run:

```bash
git add README.md
git commit -m "docs: document mdf task system"
```

Expected: Commit succeeds with README changes only.

### Task 5: Final Verification and Cleanup

**Files:**
- Verify: `skills/task/SKILL.md`
- Verify: `skills/tasks/SKILL.md`
- Verify: `commands/task.md`
- Verify: `commands/tasks.md`
- Verify: `README.md`
- Verify unchanged unless intentionally modified: `.codex-plugin/plugin.json`, `.claude-plugin/plugin.json`, `skills/mdf-handshake/SKILL.md`, `commands/mdf-handshake.md`

- [ ] **Step 1: Verify all expected files exist**

Run:

```bash
test -f skills/task/SKILL.md && test -f skills/tasks/SKILL.md && test -f commands/task.md && test -f commands/tasks.md
```

Expected: No output and exit code `0`.

- [ ] **Step 2: Verify prefix-free skill names**

Run:

```bash
rg '^name: (task|tasks)$' skills/task/SKILL.md skills/tasks/SKILL.md
```

Expected: Output shows `name: task` and `name: tasks`.

- [ ] **Step 3: Verify the exact storage path is documented in skills and README**

Run:

```bash
rg '~/.mdf/projects/\\{project-hash\\}' skills/task/SKILL.md skills/tasks/SKILL.md README.md
```

Expected: Output shows matches in all three files.

- [ ] **Step 4: Verify `status` frontmatter is not introduced**

Run:

```bash
rg '^status:' skills/task/SKILL.md skills/tasks/SKILL.md README.md
```

Expected: No output and exit code `1`.

- [ ] **Step 5: Verify manifests were not changed**

Run:

```bash
git diff -- .codex-plugin/plugin.json .claude-plugin/plugin.json
```

Expected: No output.

- [ ] **Step 6: Verify handshake files were not changed**

Run:

```bash
git diff -- skills/mdf-handshake/SKILL.md commands/mdf-handshake.md
```

Expected: No output.

- [ ] **Step 7: Review the full diff**

Run:

```bash
git diff --stat main...HEAD
git diff -- docs/superpowers/specs/2026-05-08-mdf-task-system-design.md docs/superpowers/plans/2026-05-08-mdf-task-system.md skills/task/SKILL.md skills/tasks/SKILL.md commands/task.md commands/tasks.md README.md
```

Expected: Diff shows only the spec, this plan, two new skills, two new command shims, and README task-system documentation.

- [ ] **Step 8: Confirm working tree state**

Run:

```bash
git status --short --branch
```

Expected: Branch is `task-system-design`. Only `TASK-SYSTEM-DESIGN.md` may remain untracked as the source design note unless the implementer intentionally adds or removes it.

## Self-Review

- Spec coverage: Tasks 1 and 2 cover all `task` and `tasks` behavior, storage, counter repair, derived status, locks, deletion confirmation, and error handling. Task 3 covers Claude command shims. Task 4 covers README documentation. Task 5 covers acceptance criteria and unchanged-file verification.
- Placeholder scan: This plan contains no unresolved placeholders, no unspecified helper functions, and no implementation step that says to add generic validation without exact behavior.
- Type and name consistency: Skill names are `task` and `tasks`; directories are `skills/task/` and `skills/tasks/`; command shims are `commands/task.md` and `commands/tasks.md`; storage path is `~/.mdf/projects/{project-hash}` throughout.
