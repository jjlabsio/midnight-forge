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
├── project/init.json
├── index.jsonl
├── work/
└── locks/
```

Before reading or writing MDF task state, verify MDF init state:

1. User init exists at `~/.mdf/user/init.json`.
2. `~/.mdf/user/preferences.json` exists and has a non-empty `human_language`.
3. Project init exists at `<canonical-root>/.mdf/project/init.json`.
4. The canonical project layout exists.

If init state is missing or malformed, stop before reading or writing MDF task state and instruct the user to run `mdf init`. Do not auto-initialize from this skill. Do not edit `.gitignore`, create setup branches, create setup commits, push setup branches, or create setup PRs from this skill; local workflow-state setup belongs only to `mdf init`.

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

When `mdf init` initializes `<canonical-root>/.mdf/`, it upserts this project into `~/.mdf/projects.json`. The file must use this schema:

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

When a user explicitly names a task ID for work, normalize the requested ID to a 4-digit string before lookup. Examples: `49`, `0049`, `work 49`, `work 0049`, `start 49`, and `task 49` all name `task_id: "0049"`.

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
depends_on: ["0002"]
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

Required frontmatter fields are `work_id`, `task_id`, `kind`, `title`, `order`, `status`, and `created`. Optional fields are `due`, `completed`, `worktree`, `branch`, `depends_on`, and `latest`.

`depends_on` is optional machine-readable dependency metadata. When present, it
must be a list of normalized 4-digit task IDs that are hard blockers for this
task. Do not add `depends_on` for tasks that are merely related, likely to touch
the same files, or plausibly useful context but not clearly blocking. Record
ambiguous or non-blocking relationships in `## Context` instead.

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

## Dependency Readiness

Task dependencies are hard blockers only when listed in `depends_on`. Readiness
checks must scan canonical `.mdf/work/*/item.md` cards and resolve dependencies
by exact normalized `task_id`.

A task is ready when all `depends_on` task IDs resolve to exactly one item card
and each dependency has `status: "done"` with no active consistency warning from
a matching lock. A task is blocked when any dependency is `queue` or `active`, or
when any dependency card is `done` but still has a matching lock.

Treat dependency integrity problems as stop conditions, not ordinary blocked
states:

- missing dependency task ID
- duplicate item cards for a dependency task ID
- self-dependency
- circular dependency, including indirect cycles

Report the task ID, dependency chain when known, and the reason readiness cannot
be determined. Do not silently ignore malformed dependency state.

## Staleness Preflight

Starting queued task work requires a semantic staleness preflight after exact
task ID resolution and dependency readiness, but before branch creation,
worktree creation, lock creation or replacement, task state mutation,
implementation edits, tests, commits, or other implementation side effects.

The preflight may perform read-only inspection of canonical task cards, latest spec, plan, build, and review artifacts, predecessor logs, and relevant current code or skill contracts when needed to decide whether the queued task card is still valid. This read-only inspection is not an implementation side effect.

Compare the queued task card's context, files, criteria, assumptions, and
non-blocking related-task notes against newer artifacts and contracts. Treat
`depends_on` as hard-blocker readiness only; do not broaden dependency readiness into semantic drift detection, and do not treat shared files alone as a hard dependency or stale-task signal.

If the task card is stale, contradicted, or missing a required decision because
earlier work changed design, architecture, contracts, workflow semantics, task
boundaries, or shared acceptance assumptions, stop before side effects. Report
the stale assumption, the impacted context or criteria, the evidence inspected,
and whether the next step is a user decision, a plan revision, or an update to
task logs, context, or criteria.

## Downstream Impact Check

When completing a task, or when a task changes design, architecture, contracts,
workflow semantics, task boundaries, or shared acceptance assumptions, run a
downstream impact check against queued task cards before treating the workflow
state as safe to continue.

The downstream impact check classifies queued tasks by semantic effect:
unaffected, needs task log/context/criteria update, needs plan revision or
linked superseding artifact, or needs user/replan decision before implementation.
Use read-only inspection of canonical task cards, latest artifacts, predecessor
logs, and relevant current code or skill contracts. Do not classify impact from shared files alone, and do not convert semantic impact into `depends_on` unless there is a true hard blocker.

When the current task invalidates a queued task's assumptions, preserve the
evidence with a dated task log entry, updated task context or criteria, a plan
revision, or a clearly linked superseding artifact. If the correct change
requires product, architecture, API, migration, or release judgment, stop and
ask for the user or replan decision instead of silently rewriting the queued
task.

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

If `using-git-worktrees` stops because `.worktrees/` is not ignored or project init is missing, do not create or replace `.mdf/locks/{id}.lock`; leave the task queued and instruct the user to run `mdf init`. If `mdf init` creates a setup branch for ignored worktrees, it may use `chore/ignore-worktrees` or a similarly clear unique branch. Do not resume or lock the original task until the setup PR has been merged. If worktree setup fails or stops for any reason, do not create or replace the task lock. Report the worktree issue and leave the task queued.

After `using-git-worktrees` succeeds, create `.mdf/locks/{id}.lock` using the canonical root, work ID, resulting worktree path, and branch. Update `item.md` with `status: "active"`, `worktree`, and `branch`. Continue the task briefing from that worktree.

`work {id}` prepares and briefs the task. It does not authorize implementation. After printing the briefing, stop. Do not modify project code, run implementation steps, create commits, run tests, or continue into the task unless the user gives a separate explicit implementation instruction.

## Intent Parsing

Users do not need to memorize exact command names. Treat the commands below as canonical operations, and map clear natural-language requests to the nearest command before acting.

Use these mappings:

- "add this as a task", "create a task", or similar -> `add "description"`
- "put this first", "next task", or similar -> `add "description" --next`
- "add a due date", "due", or similar -> `add "description" --due DATE`
- "work on 0002", "start 0002", or similar -> `work 0002`
- "start the next queued task" or similar -> choose the first ready queue task by dependency readiness and then `order`, report skipped blocked tasks, and perform `work {id}`
- "done", "complete this", or similar -> `done`
- "complete 0002" or similar -> `done 0002`
- "log this", "note", or similar -> `note {id} "message"`
- "move earlier", "bump this", or similar -> `bump {id}`
- "move to top", "top this", or similar -> `top {id}`
- "delete", "remove", "drop", or similar -> `drop {id}`

If the intent maps to exactly one safe command, execute it. If the intent is ambiguous, ask one short clarifying question before changing task state. Keep explicit confirmation for destructive commands such as `drop`.

## Commands

### `add "description"`

Create a queued task.

1. Verify MDF user and project init state exists. If it is missing, stop and instruct the user to run `mdf init`.
2. Ensure `<canonical-root>/.mdf/` exists with `project.json`, `project/init.json`, `index.jsonl`, `work/`, and `locks/`.
3. Scan `.mdf/work/*/item.md` and find the largest existing numeric `task_id`.
4. Choose the next 4-digit task ID and derive a work ID from the current date, task ID, and title slug.
5. Set `order` to one greater than the current maximum order among queue work items, or `1` if no queue items exist.
6. Generate a short title from the description.
7. Inspect existing queue, active, and done task cards for clear blocking dependencies implied by the user's wording, conversation context, and existing task context.
8. Add optional `depends_on` only when a dependency is clearly blocking. Use normalized 4-digit task IDs. Do not treat shared files alone as a hard dependency signal.
9. Create `.mdf/work/{work_id}/item.md` with `kind: "task"`, `status: "queue"`, optional `depends_on` when clear blockers exist, and empty `latest`.
10. Fill `Context` with handoff-quality context for a fresh session that cannot see the original conversation. Include the user's goal, relevant background, decisions already discussed, constraints, non-goals, rejected alternatives, assumptions, open questions, implementation guidance, and verification expectations when known. Prefer complete explicit context over brevity when context loss would make later implementation guessy. Record plausible, ambiguous, shared-file-only, or merely related task relationships here instead of in `depends_on`.
11. Fill `Files` with directly relevant known files, including paths explicitly mentioned by the user and paths discovered during task creation when they are clearly tied to the work. Avoid broad directories, unrelated paths, and speculative file lists.
12. Fill `Criteria` with checklist items explicitly stated or clearly implied by the user, including completion, verification, and handoff expectations when known. Leave it empty when criteria are not known.
13. Append `- YYYY-MM-DD: Created task.` to `Log`.
14. Append or update the work item's line in `.mdf/index.jsonl`.
15. Report the task ID, work ID, title, item file path, and any hard dependencies recorded. If related tasks were recorded only as context, say so.

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
8. Validate dependency readiness before creating a branch, creating a worktree, creating or replacing a lock, reading implementation files, inspecting implementation code, mutating task state, or modifying project code.
9. If dependency integrity is malformed, stop and report the exact problem. Do not offer override for missing, duplicate, self, or circular dependency state until the task metadata is corrected.
10. If dependencies are unfinished, stop and show task ID, dependency task IDs, dependency statuses, and the side effects that were not performed. Ask whether the user explicitly wants to override dependency readiness. If the user confirms override, append a dated log entry to `item.md` before continuing.
11. Run the staleness preflight before branch creation, worktree creation, lock creation or replacement, task state mutation, implementation edits, tests, commits, or other implementation side effects. Read-only inspection of canonical task cards, latest artifacts, predecessor logs, and relevant current code or skill contracts is allowed for the preflight.
12. If the staleness preflight finds stale or contradicted task context, files, criteria, assumptions, or related-task notes, stop and report the stale assumption, impacted context or criteria, evidence inspected, and required user or replan decision. Do not create a branch, create a worktree, create or replace a lock, mutate task state, or modify project code.
13. If `.mdf/locks/{id}.lock` exists, show lock details and ask whether to take over.
14. Use `using-git-worktrees` to ensure an isolated worktree before creating or replacing a lock. For normal checkouts on `main` or the default branch, create the task worktree automatically. If `.worktrees/` is not initialized and ignored, stop and instruct the user to run `mdf init`. Stop without locking the task if worktree setup does not complete.
15. Create or replace `.mdf/locks/{id}.lock` only after there is no lock or takeover is confirmed and dependency readiness, staleness preflight, and the worktree guard have succeeded. The lock must record the resulting worktree path and branch, plus `task_id`, `work_id`, `canonical_root`, `started`, and `runtime`.
16. Read files listed in `## Files` when those paths exist relative to the resulting worktree.
17. Update `item.md` with `status: "active"`, `worktree`, and `branch`, then update `.mdf/index.jsonl`.
18. Print a briefing with task title, work ID, status, canonical root, worktree, branch, dependency status, context, file summaries, criteria, and recent log entries.
19. Stop after the briefing. Do not implement, edit project code, run tests, create commits, or continue into the task unless the user gives a separate explicit implementation instruction after the briefing.

### `done`

Complete the current active task.

1. Scan `.mdf/locks/*.lock`.
2. If exactly one active task exists for the current project, complete it.
3. If none exist, ask for a task ID.
4. If multiple active tasks exist, list them and ask for a task ID.

Before completing a task whose work changed design, architecture, contracts, workflow semantics, task boundaries, or shared acceptance assumptions, run the downstream impact check. Record unaffected/updated/revision-needed/decision-needed results in the current task log or a linked artifact, and stop before completion if a user or replan decision is required.

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
2. Scan canonical task cards for other tasks whose `depends_on` includes this task ID.
3. Show the task ID, title, whether a matching lock exists, and any dependent task IDs and titles that would be left pointing at a deleted task.
4. Ask for confirmation before deleting.
5. After confirmation, delete `.mdf/work/{work_id}/` and `.mdf/locks/{id}.lock` if present, then append a tombstone entry to `.mdf/index.jsonl`.

## Error Handling

Report clear errors for missing task ID, missing explicit task ID matches, duplicate explicit task ID matches, unknown subcommand, missing item file, malformed frontmatter, invalid due date, ambiguous due date, attempting `bump` or `top` on active or done tasks, existing locks without takeover confirmation, blocked dependency readiness, missing dependency task IDs, duplicate dependency task IDs, self-dependencies, circular dependencies, and malformed `depends_on` values.
