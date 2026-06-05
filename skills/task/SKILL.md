---
name: task
description: "Manage one local MDF task lifecycle from any worktree using canonical project-root .mdf storage."
---

# task

Use this skill when the user invokes `$task` in Codex or `/mdf:task` in Claude Code.

This skill is LLM-driven. Do not use an MCP server, CLI helper, background runner, event store, or network service. Read and write files directly with the available local tools.

## Storage Model

The authoritative MDF state for a project lives in the canonical project root, not inside linked worktrees and not as the primary source under `~/.mdf/projects/{project-hash}`.

Resolve the canonical project root from the first available source:

1. If the current checkout path is under `<root>/.worktrees/<branch>`, use `<root>`.
2. Otherwise use `git rev-parse --show-toplevel`.
3. If not inside a git repository, use the absolute current working directory.

Project storage layout:

```text
<canonical-root>/.mdf/
├── project.json
├── index.jsonl
├── work/
└── locks/
```

Initialize this layout lazily for write commands. Do not create storage for read-only errors. Before creating or writing `.mdf/` inside a git repository, verify that `.mdf/` is ignored by git. Check the directory-form path with a trailing slash, such as `git check-ignore -q "<canonical-root>/.mdf/"`, so a `.gitignore` entry like `.mdf/` is recognized even before the `.mdf` directory exists.

If `.mdf/` is not ignored:

1. Do not create or write `.mdf/`.
2. Ask whether to create a setup branch that adds `.mdf/` to `.gitignore` and opens a PR before starting the task.
3. If the user agrees, perform setup from the normal repository checkout, not from a task worktree. Stop first if the checkout has uncommitted changes.
4. Create a branch named `chore/ignore-mdf`, or `chore/ignore-local-workflow-state` when adding both `.mdf/` and `.worktrees/`.
5. Add `.mdf/` to `.gitignore` without changing unrelated ignore rules. Create `.gitignore` if the repository does not have one.
6. Commit the change with the message `chore: ignore local mdf state`, or `chore: ignore local workflow state` when adding both `.mdf/` and `.worktrees/`.
7. If the user agreed to open the PR, push the setup branch and create a GitHub PR with the `release-none` label. If pushing or PR creation fails, report the branch, commit, and exact failure.
8. Do not resume the original task or artifact write until the setup PR has been merged and the command is run again.

Do not create an independent `.mdf/` directory inside a linked worktree. A task running from `<canonical-root>/.worktrees/<branch>` still reads and writes `<canonical-root>/.mdf/`.

`project.json`:

```json
{
  "name": "project-basename",
  "canonical_root": "/absolute/project/root",
  "remote": "git@github.com:user/project.git",
  "created": "2026-05-08T00:00:00Z"
}
```

Use the canonical root basename for `name`. Include `remote` when origin exists; otherwise set it to `null`. Use an ISO-8601 timestamp for `created`.

`index.jsonl` contains one JSON object per known work item. Keep each line compact so agents can scan it before opening markdown files:

```jsonl
{"work_id":"2026-05-26-0001-artifact-storage-policy","task_id":"0001","title":"Artifact storage policy","status":"queue","item":".mdf/work/2026-05-26-0001-artifact-storage-policy/item.md","latest":{}}
```

When a task or artifact changes, update or append the corresponding index entry so the latest line for a `work_id` is authoritative.

Whenever `<canonical-root>/.mdf/` is initialized, upsert this project into `~/.mdf/projects.json`. The file must use this schema:

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

Use `projects[canonical_root]` as the upsert target and preserve unrelated project entries. Set `id` to the first 12 lowercase hex characters of SHA-256 over `remote` when present, otherwise over `canonical_root`. If `~/.mdf/projects.json` is missing, create it with `version: 1` and an empty `projects` object before upserting. If it exists but is malformed or does not match this schema, stop and report the registry problem instead of overwriting it.

## Work Items and IDs

A work item is one workflow context. A task-backed work item has `kind: "task"`. Future artifact-producing skills may create `kind: "implicit"` work items when no task lock exists, but this `task` skill creates task-backed work items.

Task IDs are 4-digit zero-padded strings such as `"0001"`. Work item IDs include the date, task ID, and a lowercase slug:

```text
2026-05-26-0001-artifact-storage-policy
```

Before creating a task, scan `.mdf/work/*/item.md` for existing `task_id` values and choose one greater than the largest numeric ID. Never choose an ID whose work item directory already exists. Do not overwrite an existing `item.md`.

When a user explicitly names a task ID for work, normalize the requested ID to a 4-digit string before lookup. Examples: `49`, `0049`, `work 49`, `work 0049`, `0049 작업`, and `49 작업` all name `task_id: "0049"`.

Explicit task IDs are exact identifiers, not search hints. Before creating a branch, creating a worktree, creating or replacing a lock, reading implementation files, inspecting code, mutating task state, or modifying project code, resolve exactly one matching item card by `task_id` from the current project's canonical `.mdf/work/*/item.md`.

If no canonical item card matches the normalized explicit task ID, stop immediately and ask the user to confirm the intended project or task ID. Do not infer or substitute another task from similar titles, keywords, branches, worktrees, lock files, current code state, or surrounding natural-language hints. Related tasks may be mentioned only as informational context after stopping.

If multiple item cards claim the same normalized explicit task ID, stop and report the duplicated task state. Do not choose one.

## Work Item File Format

Each task-backed work item has an item card at `.mdf/work/{work_id}/item.md`:

```markdown
---
work_id: "2026-05-26-0001-artifact-storage-policy"
task_id: "0001"
kind: "task"
title: "Short task title"
order: 1
status: "queue"
created: "2026-05-08"
due: "2026-05-10"
completed: "2026-05-12"
worktree: null
branch: null
latest: {}
---

## Context

Handoff-quality context for a fresh session that cannot see the original conversation. Include the user's goal, relevant background, decisions already made, constraints, non-goals, rejected alternatives, assumptions, open questions, implementation guidance, and verification expectations when known. Prefer complete explicit context over brevity when omitting detail would make later implementation guessy.

## Files

Directly relevant known files. Include paths explicitly mentioned by the user and paths discovered during task creation when they are clearly tied to the work. Avoid broad directories, unrelated paths, and speculative file lists.

- path/explicitly/mentioned.ts

## Criteria

- [ ] Criterion explicitly stated or clearly implied by the user

## Log

- 2026-05-08: Created task.
```

Task item cards are handoff documents, not just reminders. For `## Context`, preserve the information a later agent or fresh session would need to continue safely without access to the original conversation. Do not compress away important decisions, constraints, rejected alternatives, assumptions, open questions, or verification expectations merely to keep the section short.

Required frontmatter fields are `work_id`, `task_id`, `kind`, `title`, `order`, `status`, and `created`. Optional fields are `due`, `completed`, `worktree`, `branch`, and `latest`.

Always keep these English section headers, even when a section is empty:

```markdown
## Context

## Files

## Criteria

## Log
```

## Status

Store `status` in `item.md` as one of:

1. `queue`
2. `active`
3. `done`

Use locks as active ownership markers. If `locks/{task_id}.lock` exists but `item.md` is not `active`, display the task as active and show a consistency warning. If `item.md` is `done` and a matching lock exists, display it as active and show a consistency warning. Do not silently delete the lock.

## Lock Files

Starting work creates `.mdf/locks/{task_id}.lock`:

```json
{
  "task_id": "0001",
  "work_id": "2026-05-26-0001-artifact-storage-policy",
  "canonical_root": "/absolute/project/root",
  "worktree": "/absolute/project/root/.worktrees/task-0001-artifact-storage-policy",
  "branch": "task-0001-artifact-storage-policy",
  "started": "2026-05-08T00:00:00Z",
  "runtime": "codex"
}
```

Do not require `pid`. Locks are ownership markers, not process liveness proofs.

When a lock already exists, show task ID, work ID, title, canonical root, worktree, branch, runtime, and started time. Ask the user before takeover. If the user confirms takeover, replace the lock and append a dated log entry to `item.md`.

## Worktree Guard

Before starting implementation work for a task, use the `using-git-worktrees` skill to ensure work happens outside `main` or the repository default branch.

This guard applies to `work {id}` before creating or replacing `locks/{id}.lock`. In the canonical storage model, that lock path is `<canonical-root>/.mdf/locks/{id}.lock`.

For MDF task work, derive the target branch from the task ID and title:

```text
task-0002-worktree-pr-lifecycle-guardrails
```

Use a lowercase ASCII slug for the title, remove punctuation, collapse separators to `-`, and keep the branch human-readable. The target worktree path must follow the `using-git-worktrees` policy:

```text
<canonical-root>/.worktrees/<branch-name>
```

If the current checkout is already a linked worktree, use it only when the `using-git-worktrees` skill accepts it. If the current checkout is a normal repository checkout on `main` or the default branch, automatically create the task worktree through `using-git-worktrees`.

If `using-git-worktrees` stops because `.worktrees/` is not ignored, handle that as repository setup work before task activation:

1. Do not create or replace `.mdf/locks/{id}.lock`; leave the task queued.
2. Ask whether to create a setup branch that adds `.worktrees/` to `.gitignore` and opens a PR before starting the task.
3. If the user agrees, perform the setup from the normal repository checkout, not from a task worktree. Stop first if the checkout has uncommitted changes.
4. Create a branch named `chore/ignore-worktrees`, or a similarly clear unique branch if that branch already exists.
5. Add `.worktrees/` to `.gitignore` without changing unrelated ignore rules. Create `.gitignore` if the repository does not have one.
6. Commit the change with the message `chore: ignore local worktrees`.
7. If the user agreed to open the PR, push the setup branch and create a GitHub PR with the `release-none` label. If pushing or PR creation fails, report the branch, commit, and exact failure.
8. Do not resume or lock the original task until the setup PR has been merged and `work {id}` is run again.

If worktree setup fails or stops for any reason, do not create or replace the task lock. Report the worktree issue and leave the task queued.

After `using-git-worktrees` succeeds, create `.mdf/locks/{id}.lock` using the canonical root, work ID, resulting worktree path, and branch. Update `item.md` with `status: "active"`, `worktree`, and `branch`. Continue the task briefing from that worktree.

## Intent Parsing

Users do not need to memorize exact command names. Treat the commands below as canonical operations, and map clear natural-language requests to the nearest command before acting.

Use these mappings:

- "add this as a task", "create a task", "task로 추가해", or similar -> `add "description"`
- "put this first", "next task", "다음에 할 일로 추가해", or similar -> `add "description" --next`
- "add a due date", "due", "마감일", or similar -> `add "description" --due DATE`
- "work on 0002", "0002 작업할게", "0002 시작", or similar -> `work 0002`
- "start the next queued task", "다음 작업 시작", or similar -> choose the first queue task by `order` and perform `work {id}`
- "done", "complete this", "완료", "끝났어", or similar -> `done`
- "complete 0002", "0002 완료", or similar -> `done 0002`
- "log this", "note", "메모 남겨", or similar -> `note {id} "message"`
- "move earlier", "우선순위 올려", or similar -> `bump {id}`
- "move to top", "맨 위로", or similar -> `top {id}`
- "delete", "remove", "drop", "삭제", or similar -> `drop {id}`

If the intent maps to exactly one safe command, execute it. If the intent is ambiguous, ask one short clarifying question before changing task state. Keep explicit confirmation for destructive commands such as `drop`.

## Commands

### `add "description"`

Create a queued task.

1. Initialize project storage if needed.
2. Ensure `.mdf/` is ignored by git before writing. If not ignored, follow the `.mdf/` setup branch and PR flow and stop.
3. Ensure `<canonical-root>/.mdf/` exists with `project.json`, `index.jsonl`, `work/`, and `locks/`, then upsert `~/.mdf/projects.json`.
4. Scan `.mdf/work/*/item.md` and find the largest existing numeric `task_id`.
5. Choose the next 4-digit task ID and derive a work ID from the current date, task ID, and title slug.
6. Set `order` to one greater than the current maximum order among queue work items, or `1` if no queue items exist.
7. Generate a short title from the description.
8. Create `.mdf/work/{work_id}/item.md` with `kind: "task"`, `status: "queue"`, and empty `latest`.
9. Fill `Context` with handoff-quality context for a fresh session that cannot see the original conversation. Include the user's goal, relevant background, decisions already discussed, constraints, non-goals, rejected alternatives, assumptions, open questions, implementation guidance, and verification expectations when known. Prefer complete explicit context over brevity when context loss would make later implementation guessy.
10. Fill `Files` with directly relevant known files, including paths explicitly mentioned by the user and paths discovered during task creation when they are clearly tied to the work. Avoid broad directories, unrelated paths, and speculative file lists.
11. Fill `Criteria` with checklist items explicitly stated or clearly implied by the user, including completion, verification, and handoff expectations when known. Leave it empty when criteria are not known.
12. Append `- YYYY-MM-DD: Created task.` to `Log`.
13. Append or update the work item's line in `.mdf/index.jsonl`.
14. Report the task ID, work ID, title, and item file path.

### `add "description" --next`

Same as `add`, except set `order` to one less than the current minimum queue order, or `0` if no queue work items exist.

### `add "description" --due DATE`

Same as `add`, and write a `due` frontmatter field. Parse dates with the current year when the user omits a year. If the date is invalid or ambiguous, ask for clarification before writing.

### `work {id}`

Start a specific task.

1. Require a task ID.
2. Normalize the requested task ID to a 4-digit string before lookup.
3. Resolve the canonical project root, then scan only `<canonical-root>/.mdf/work/*/item.md` for item cards whose frontmatter `task_id` exactly equals the normalized ID.
4. If no item card matches, stop immediately and ask the user to confirm the intended project or task ID. Do not create a branch, create a worktree, create or replace a lock, read implementation files, inspect code to infer likely intent, mutate task state, or modify project code.
5. If more than one item card matches, stop and report the duplicated task state. Do not choose one.
6. Do not substitute similar tasks based on title, keywords, branches, worktrees, lock files, current code state, or surrounding natural-language hints. Related tasks may be mentioned only as informational context after stopping.
7. Reject done tasks.
8. If `.mdf/locks/{id}.lock` exists, show lock details and ask whether to take over.
9. Use `using-git-worktrees` to ensure an isolated worktree before creating or replacing a lock. For normal checkouts on `main` or the default branch, create the task worktree automatically. If `.worktrees/` is not ignored, offer the setup branch and PR flow from the Worktree Guard section instead of locking the task. Stop without locking the task if worktree setup does not complete.
10. Create or replace `.mdf/locks/{id}.lock` only after there is no lock or takeover is confirmed and the worktree guard has succeeded. The lock must record the resulting worktree path and branch, plus `task_id`, `work_id`, `canonical_root`, `started`, and `runtime`.
11. Read files listed in `## Files` when those paths exist relative to the resulting worktree.
12. Update `item.md` with `status: "active"`, `worktree`, and `branch`, then update `.mdf/index.jsonl`.
13. Print a briefing with task title, work ID, status, canonical root, worktree, branch, context, file summaries, criteria, and recent log entries.

### `done`

Complete the current active task.

1. Scan `.mdf/locks/*.lock`.
2. If exactly one active task exists for the current project, complete it.
3. If none exist, ask for a task ID.
4. If multiple active tasks exist, list them and ask for a task ID.

Completion means setting `status: "done"` and `completed: YYYY-MM-DD` in `item.md`, appending `- YYYY-MM-DD: Completed task.` to `## Log`, updating `.mdf/index.jsonl`, and deleting `.mdf/locks/{id}.lock` if it exists.

### `done {id}`

Complete the specified task using the same completion behavior as `done`.

### `done {id} --message "message"`

Complete the specified task using the same completion behavior as `done`, but append the provided message to `## Log`:

```markdown
- YYYY-MM-DD: message
```

Use this form when another MDF workflow completes a task for a specific lifecycle reason, such as PR preparation. Do not change any other completion behavior: still set `status: "done"`, add `completed: YYYY-MM-DD` to frontmatter, update `.mdf/index.jsonl`, and delete `.mdf/locks/{id}.lock` if it exists.

### `bump {id}`

Move a queue task one position earlier. Reject active or done tasks. Swap its `order` with the nearest queue task that has a smaller order. If it is already first, report that no change is needed.

### `top {id}`

Move a queue task to the top. Reject active or done tasks. Set its `order` to one less than the current minimum queue order.

### `note {id} "message"`

Append a dated entry to `## Log`:

```markdown
- YYYY-MM-DD: message
```

Preserve frontmatter and all other sections, then update the matching `.mdf/index.jsonl` entry if the note changes summary metadata.

### `drop {id}`

Delete a task only after explicit user confirmation.

1. Load the task title.
2. Show the task ID, title, and whether a matching lock exists.
3. Ask for confirmation before deleting.
4. After confirmation, delete `.mdf/work/{work_id}/` and `.mdf/locks/{id}.lock` if present, then append a tombstone entry to `.mdf/index.jsonl`.

## Error Handling

Report clear errors for missing task ID, missing explicit task ID matches, duplicate explicit task ID matches, unknown subcommand, missing item file, malformed frontmatter, invalid due date, ambiguous due date, attempting `bump` or `top` on active or done tasks, and existing locks without takeover confirmation.
