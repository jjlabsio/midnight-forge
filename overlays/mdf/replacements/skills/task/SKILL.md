---
name: task
description: "Manage one local MDF task lifecycle from any worktree using canonical project-root .mdf storage."
---

# task

Use this skill when the user invokes `$task` in Codex.

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
{"work_id":"2026-05-26-0001-artifact-storage-policy","kind":"task","task_id":"0001","title":"Artifact storage policy","status":"queue","item":".mdf/work/2026-05-26-0001-artifact-storage-policy/item.md","latest":{}}
{"work_id":"2026-05-26-track-0001-blog-reset","kind":"track","item_id":"track-0001","title":"Blog reset","item":".mdf/work/2026-05-26-track-0001-blog-reset/item.md","latest":{}}
```

Index entries for task items should include `kind`, `task_id`, `title`, `status`, `track_id` when present, `due` when present, `order` when present, `item`, and `latest`. Index entries for note items should include `kind`, `item_id`, `title`, `track_id` when present, `state` when present, `item`, and `latest`. Index entries for tracks should include `kind`, `item_id`, `title`, `state` when present, short `outcome` when present, `item`, and `latest`.

When a task, non-task work item, or artifact changes, update or append the corresponding index entry so the latest line for a `work_id` is authoritative.
Existing index entries that do not include `kind` are legacy task entries and must be interpreted as `kind: "task"` for backward compatibility.

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

A work item is one workflow context. MDF supports these first-class user-facing work item kinds:

1. `task`: finite executable work. This is the only kind that uses the executable lifecycle `queue`, `active`, and `done`.
2. `note`: durable context, future reminders, or not-yet-actionable material. Note items are not recommended as next tasks.
3. `track`: a thin upper-level work stream or outcome that groups related tasks and notes.

Legacy item cards with `kind: "inbox"` or `kind: "routine"` may be read for backward compatibility, displayed as non-executable context, and preserved when encountered. Do not create new `inbox` or `routine` items from this skill, do not recommend them as next tasks, and do not expose `routine` as a first-class command.

Do not call the upper-level grouping kind `project`. MDF already uses project terminology for the repository or local product/project context, and users often call repos or products projects. Use `track` for the larger work stream.

Artifact-producing skills may still create `kind: "implicit"` work items when no task lock exists. `implicit` is for workflow evidence only and is not part of the user-facing task board.

Task IDs are 4-digit zero-padded strings such as `"0001"`. Work item IDs include the date, task ID, and a lowercase slug:

```text
2026-05-26-0001-artifact-storage-policy
```

Non-task work items use an `item_id` with the kind prefix and a 4-digit counter scoped to the kind:

```text
track-0001
note-0001
```

Their work item IDs include the date, item ID, and a lowercase slug:

```text
2026-05-26-track-0001-blog-reset
```

Before creating a task, scan `.mdf/work/*/item.md` for existing `task_id` values and choose one greater than the largest numeric ID. Never choose an ID whose work item directory already exists. Do not overwrite an existing `item.md`.

Before creating a non-task work item, scan `.mdf/work/*/item.md` for existing `item_id` values with the same kind prefix and choose one greater than the largest numeric suffix. Never choose an ID whose work item directory already exists. Do not overwrite an existing `item.md`.

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
track_id: "track-0001"
latest: {}
---

## Context

Handoff-quality context for a fresh session that cannot see the original conversation. Preserve the user's discussed intent, wording, constraints, non-goals, rejected alternatives, and open questions. Keep agent interpretation, assumptions, implementation ideas, and verification expectations clearly labeled and separate from user-confirmed context when they are useful. Do not turn rough, partial, or exploratory user input into finalized requirements or implementation guidance.

## Files

Directly relevant known files. Include paths explicitly mentioned by the user and paths discovered during task creation when they are clearly tied to the work. Avoid broad directories, unrelated paths, and speculative file lists.

- path/explicitly/mentioned.ts

## Criteria

- [ ] Criterion explicitly stated by the user or already agreed in the conversation

## Log

- 2026-05-08: Created task.
```

Task item cards are handoff documents, not just reminders. For `## Context`, preserve the information a later agent or fresh session would need to continue safely without access to the original conversation. Do not compress away important decisions, constraints, rejected alternatives, assumptions, open questions, or verification expectations merely to keep the section short.

Task creation must preserve intent without over-confirming it. When the user is intentionally rough, exploratory, or postponing details until task execution, record that state as such. Do not promote agent-added detail into user-confirmed context, criteria, dependencies, implementation guidance, or scope. If agent interpretation is necessary for handoff quality, label it explicitly as agent interpretation, an assumption, or an open question.

Required frontmatter fields for `kind: "task"` are `work_id`, `task_id`, `kind`, `title`, `order`, `status`, and `created`. Optional task fields are `due`, `completed`, `worktree`, `branch`, `depends_on`, `track_id`, and `latest`.

Non-task work item cards use the same body section format, but they do not have `task_id`, `order`, `status`, `worktree`, `branch`, or `depends_on` unless a future migration explicitly defines a backward-compatible reason. Required frontmatter fields for `kind: "note"` and `kind: "track"` are `work_id`, `item_id`, `kind`, `title`, `created`, and `latest`.

Note items may include:

```yaml
state: "open"
track_id: "track-0001"
```

Track items may include:

```yaml
state: "open"
outcome: "Reset the blog around a smaller set of search-intent clusters."
members:
  tasks: ["0001", "0002"]
  notes: ["note-0001"]
```

For membership, item-side `track_id` is authoritative for tasks and notes. A track's `members` list is a display convenience and may be incomplete; board commands should derive membership from item-side `track_id` when possible.

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

For `kind: "task"`, store `status` in `item.md` as one of:

1. `queue`
2. `active`
3. `done`

Use locks as active ownership markers. If `locks/{task_id}.lock` exists but `item.md` is not `active`, display the task as active and show a consistency warning. If `item.md` is `done` and a matching lock exists, display it as active and show a consistency warning. Do not silently delete the lock.

Do not use task lifecycle statuses for `note` or `track`. These kinds may use optional `state: "open"` or `state: "archived"` metadata for display and cleanup, but they are not executable queue entries and must not be selected by "next task" logic. Legacy `inbox` and `routine` cards follow the same non-executable rule when encountered.

## Dependency Readiness

Task dependencies are hard blockers only when listed in `depends_on`. Readiness
checks must scan canonical `.mdf/work/*/item.md` cards whose `kind` is `task`
or whose legacy frontmatter omits `kind`, and resolve dependencies by exact
normalized `task_id`.

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

When the queued task has `track_id`, inspect related `track`, `note`, and
legacy `inbox` or `routine` cards in read-only mode as semantic context for drift. Related
non-task cards may reveal stale assumptions or missing decisions, but they are
not executable start candidates.

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
Use read-only inspection of canonical task cards, related `track`, `note`, and
legacy `inbox` or `routine` cards, latest artifacts, predecessor logs, and
relevant current code or skill contracts. Do not classify impact from shared
files alone, and do not convert semantic impact into `depends_on` unless there
is a true hard blocker.

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

If `using-git-worktrees` stops because `.worktrees/` is not ignored or project init is missing, do not create or replace `.mdf/locks/{id}.lock`; leave the task queued and instruct the user to run `mdf init`. If `mdf init` creates a setup branch for ignored worktrees, it may use `chore/ignore-worktrees` or a similarly clear unique branch. Do not resume or lock the original task until the setup PR has been merged.

Treat `using-git-worktrees` as the full worktree readiness gate for task activation: it creates or accepts the isolated worktree, copies root-level `.env*` files, installs dependencies when a recognized manifest exists, and runs Prisma client generation when Prisma is detected. If worktree setup or readiness setup fails or stops for any reason, do not create or replace the task lock. Report the failed setup step and leave the task queued.

After `using-git-worktrees` succeeds, create `.mdf/locks/{id}.lock` using the canonical root, work ID, resulting worktree path, and branch. Update `item.md` with `status: "active"`, `worktree`, and `branch`. Continue the task briefing from that worktree.

`work {id}` prepares and briefs the task. It does not authorize implementation.
For standalone `work {id}`, after printing the briefing, stop. Do not modify
project code, run implementation steps, create commits, run tests, or continue
into the task unless the user gives a separate explicit implementation
instruction.

If the same user message already contains an explicit downstream workflow such
as `auto-workflow`, `build`, `implement`, `continue`, or `proceed`, that
downstream workflow is the separate explicit implementation instruction. After
successful dependency readiness, staleness preflight, lock handling, worktree
guard, worktree readiness setup, task state update, and briefing, continue into
the named downstream workflow without requiring another user turn. Do not treat task activation alone as implementation permission. Do not bypass any real stop condition such
as missing or duplicate task IDs, dependency blockers, malformed dependency
state, lock takeover confirmation, worktree setup ambiguity or failure,
worktree readiness setup failure, or missing init state.

## Intent Parsing

Users do not need to memorize exact command names. Treat the commands below as canonical operations, and map clear natural-language requests to the nearest command before acting.

Use these mappings:

- "add this as a task", "create a task", "task this", or similar actionable work -> `task "description"`
- "put this first", "next task", or similar -> `task "description" --next`
- "add a due date", "due", or similar -> `task "description" --due DATE`
- "save this note", "remember this", or similar non-actionable context -> `note "description"`
- "make a track", "group this work", or similar larger work-stream request -> `track "description"`
- "put this in track X", "associate this with track X", or similar -> resolve the target item and track from natural language, set item-side `track_id`, and update `.mdf/index.jsonl`; ask one short question if either side is ambiguous
- "turn this note into a task" or similar -> create a new task using `task "description"` with relevant context from the note; do not mutate the source note into a task
- "work on 0002", "start 0002", or similar -> `work 0002`
- "start the next queued task" or similar -> choose the first ready `kind: "task"` queue item by dependency readiness and then `order`, report skipped blocked tasks, and perform `work {id}`
- "done", "complete this", or similar -> `done`
- "complete 0002" or similar -> `done 0002`
- "move earlier", "make this higher priority", "move to top", or similar -> resolve the intended queued task from natural language, adjust its `order`, and update `.mdf/index.jsonl`; ask one short question when the target or priority intent is ambiguous
- "delete", "remove", "drop", or similar -> `drop {id}`

If the intent maps to exactly one safe command, execute it. If the intent is ambiguous, ask one short clarifying question before changing task state. Keep explicit confirmation for destructive commands such as `drop`.

## Commands

### `task "description"`

Create a queued task.

1. Verify MDF user and project init state exists. If it is missing, stop and instruct the user to run `mdf init`.
2. Ensure `<canonical-root>/.mdf/` exists with `project.json`, `project/init.json`, `index.jsonl`, `work/`, and `locks/`.
3. Scan `.mdf/work/*/item.md` and find the largest existing numeric `task_id`.
4. Choose the next 4-digit task ID and derive a work ID from the current date, task ID, and title slug.
5. Set `order` to one greater than the current maximum order among queued task items, or `1` if no queued task items exist.
6. Generate a short title from the description without adding scope that the user did not confirm. If the intent is still rough, use a neutral title rather than an implementation-specific one.
7. Inspect existing queue, active, and done task cards for clear blocking dependencies implied by the user's wording, conversation context, and existing task context.
8. Add optional `depends_on` only when a dependency is clearly blocking. Use normalized 4-digit task IDs. Do not treat shared files alone as a hard dependency signal.
9. Add optional `track_id` only when the user clearly provided a track or when exactly one relevant track is unambiguous from the current context.
10. Create `.mdf/work/{work_id}/item.md` with `kind: "task"`, `status: "queue"`, optional `depends_on` when clear blockers exist, optional `track_id` when clear, and empty `latest`.
11. Fill `Context` with handoff-quality context for a fresh session that cannot see the original conversation. Preserve the user's discussed goal, wording, relevant background, decisions already discussed, constraints, non-goals, rejected alternatives, and open questions. Keep user-confirmed context separate from agent interpretation, assumptions, possible implementation guidance, and verification expectations. Do not convert rough, partial, or exploratory user input into finalized requirements, implementation guidance, acceptance criteria, dependencies, or scope. Record plausible, ambiguous, shared-file-only, or merely related task relationships here instead of in `depends_on`.
12. Fill `Files` with directly relevant known files, including paths explicitly mentioned by the user and paths discovered during task creation when they are clearly tied to the work. Avoid broad directories, unrelated paths, and speculative file lists.
13. Fill `Criteria` with checklist items explicitly stated by the user or already agreed in the conversation, including completion, verification, and handoff expectations when known. Do not invent acceptance criteria from rough notes, agent assumptions, or likely implementation paths. Leave it empty when criteria are not known.
14. Append `- YYYY-MM-DD: Created task.` to `Log`.
15. Append or update the work item's line in `.mdf/index.jsonl`.
16. Report the task ID, work ID, title, item file path, associated track when present, and any hard dependencies recorded. If related tasks or tracks were recorded only as context, say so.

### `task "description" --next`

Same as `task`, except set `order` to one less than the current minimum queued task order, or `0` if no queued task items exist.

### `task "description" --due DATE`

Same as `task`, and write a `due` frontmatter field. Parse dates with the current year when the user omits a year. If the date is invalid or ambiguous, ask for clarification before writing.

### `note "description"`

Create a non-executable note work item for durable context, future reminders, or material that is not ready to become a task.

1. Verify MDF user and project init state exists.
2. Choose the next `note-0001` style `item_id` and derive a work ID from the current date, item ID, and title slug.
3. Create `.mdf/work/{work_id}/item.md` with `kind: "note"`, `item_id`, `title`, `created`, optional `track_id` when clearly provided or unambiguous from natural language, and empty `latest`.
4. Do not write `task_id`, `status`, `order`, `depends_on`, `worktree`, or `branch`.
5. Fill the standard body sections with handoff-quality context. Criteria may be empty when the note is only context.
6. Append or update the work item's line in `.mdf/index.jsonl`.
7. Report that the note was saved as non-executable context and will not be recommended as a next task.

### `track "description"`

Create a thin upper-level work stream or outcome. Do not use the name `project` for this concept.

1. Verify MDF user and project init state exists.
2. Choose the next `track-0001` style `item_id` and derive a work ID from the current date, item ID, and title slug.
3. Create `.mdf/work/{work_id}/item.md` with `kind: "track"`, `item_id`, `title`, `created`, optional `outcome`, optional `state: "open"`, optional `members`, and empty `latest`.
4. Do not write `task_id`, task lifecycle `status`, `order`, `depends_on`, `worktree`, or `branch`.
5. Keep the track thin: outcome, scope context, and links to related work. Do not turn it into a replacement for specs, plans, ADRs, or durable tracked docs.
6. Append or update the work item's line in `.mdf/index.jsonl`.

Track association is handled through natural language instead of a separate user-facing command. Resolve exactly one item by `task_id` or `item_id`, resolve exactly one `kind: "track"` item by `item_id` or unambiguous title, set item-side `track_id`, optionally update the track `members` display list, and update `.mdf/index.jsonl`. Ask one short clarifying question before writing when the item or track is ambiguous.

When a note becomes actionable, create a new task using `task "description"` and carry over relevant context and `track_id` when present. Do not mutate the source note into a task. Add a dated log entry to the source note linking the new task ID only as an internal bookkeeping step, not as a user-facing command.

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
14. Use `using-git-worktrees` to ensure an isolated worktree before creating or replacing a lock. For normal checkouts on `main` or the default branch, create the task worktree automatically. If `.worktrees/` is not initialized and ignored, stop and instruct the user to run `mdf init`. Stop without locking the task if worktree setup or readiness setup does not complete.
15. Create or replace `.mdf/locks/{id}.lock` only after there is no lock or takeover is confirmed and dependency readiness, staleness preflight, the worktree guard, and worktree readiness setup have succeeded. The lock must record the resulting worktree path and branch, plus `task_id`, `work_id`, `canonical_root`, `started`, and `runtime`.
16. Read files listed in `## Files` when those paths exist relative to the resulting worktree.
17. Update `item.md` with `status: "active"`, `worktree`, and `branch`, then update `.mdf/index.jsonl`.
18. Print a briefing with task title, work ID, status, canonical root, worktree, branch, dependency status, worktree readiness results, context, file summaries, criteria, and recent log entries.
19. Stop after the briefing for standalone `work {id}`. Do not implement, edit project code, run tests, create commits, or continue into the task unless the user gives a separate explicit implementation instruction after the briefing.
20. If the same user message already contains an explicit downstream workflow, treat that workflow as the separate explicit implementation instruction and continue into it after the briefing only when all dependency readiness, staleness preflight, lock handling, worktree, worktree readiness setup, init, and task state requirements above have succeeded.

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

Priority changes are handled through natural language instead of named priority commands. Resolve exactly one queued task from the request, reject active or done tasks, adjust its `order`, and update `.mdf/index.jsonl`. If the target task or intended ordering is ambiguous, ask one short clarifying question before writing.

Appending arbitrary log entries is an internal workflow behavior, not a user-facing command. Other MDF workflows may append dated `## Log` entries when they mutate task state, create derived tasks, or complete work for lifecycle reasons.

### `drop {id}`

Delete a task only after explicit user confirmation.

1. Load the task title.
2. Scan canonical task cards for other tasks whose `depends_on` includes this task ID.
3. Show the task ID, title, whether a matching lock exists, and any dependent task IDs and titles that would be left pointing at a deleted task.
4. Ask for confirmation before deleting.
5. After confirmation, delete `.mdf/work/{work_id}/` and `.mdf/locks/{id}.lock` if present, then append a tombstone entry to `.mdf/index.jsonl`.

## Error Handling

Report clear errors for missing task ID, missing explicit task ID matches, duplicate explicit task ID matches, missing non-task `item_id` matches, duplicate non-task `item_id` matches, unknown subcommand, missing item file, malformed frontmatter, invalid due date, ambiguous due date, unresolved `track_id`, ambiguous natural-language track association, ambiguous natural-language priority changes, attempting priority changes on active or done tasks, attempting task lifecycle operations on non-task items, existing locks without takeover confirmation, blocked dependency readiness, missing dependency task IDs, duplicate dependency task IDs, self-dependencies, circular dependencies, malformed `depends_on` values, environment file copy failures during worktree readiness setup, dependency installation failures during worktree readiness setup, and Prisma generation failures during worktree readiness setup.
