---
name: migrate-tasks
description: "Migrate legacy MDF task state from ~/.mdf/projects/{project-hash} into canonical project-root .mdf work item storage."
---

# migrate-tasks

Migrate legacy MDF task storage into the canonical project-local `.mdf/work/` model. This skill is copy-first: never move, rewrite, or delete legacy files.

Use this skill when the user invokes `migrate-tasks`, `mdf migrate-tasks`, `$migrate-tasks`, `/mdf:migrate-tasks`, or asks to migrate old MDF tasks.

## Scope

This is an LLM-driven local file migration. Read and write local files directly. Do not require a separate script, service, database, or network call.

Supported intents:

- `migrate-tasks`: inspect the current project's legacy store and migrate it after explicit confirmation.
- `migrate-tasks all`: inspect all legacy project stores under `~/.mdf/projects/` and migrate accessible projects after explicit confirmation.
- `migrate-tasks --dry-run`: list candidates, conflicts, skipped files, and target paths without writing.

Default behavior is dry-run first. Always show the candidate list and wait for explicit user confirmation before writing migrated files.

## Legacy Source

Legacy project stores live at:

```text
~/.mdf/projects/{project-hash}/
  meta.json
  counter.json
  tasks/*.md
  locks/*.lock
```

Use `meta.json.path` as the canonical project root for `migrate-tasks all`. For current-project migration, resolve the canonical root from the current checkout first, then match a legacy project by `meta.json.path`, remote, or project basename. If multiple legacy stores match, stop and ask the user to choose one.

If a legacy project root is missing, inaccessible, or not a git repository, skip it and report the reason.

## Target Storage

Migrate into the canonical project root:

```text
<canonical-root>/.mdf/
  project.json
  project/init.json
  index.jsonl
  work/{work_id}/item.md
  locks/{task_id}.lock
```

Before creating or writing canonical `.mdf/` migration output, verify MDF user and project init state. If `~/.mdf/user/init.json`, `~/.mdf/user/preferences.json` with `human_language`, or `<canonical-root>/.mdf/project/init.json` is missing or malformed, stop and instruct the user to run `mdf init`. Do not auto-initialize from this skill. Do not edit `.gitignore`, create setup branches, create setup commits, push setup branches, or create setup PRs from this skill.

`mdf init` upserts the project into `~/.mdf/projects.json`. The registry must use this schema:

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

Use `projects[canonical_root]` as the upsert target and preserve unrelated project entries. If `~/.mdf/projects.json` is missing, create it with `version: 1` and an empty `projects` object before upserting. If it exists but is malformed or does not match this schema, stop and report the registry problem instead of overwriting it.

## Candidate Parsing

For each legacy `tasks/*.md` file:

1. Parse YAML frontmatter as structured data. Do not rely on ad hoc string replacement for fields.
2. Read legacy fields when present: `id`, `title`, `order`, `created`, `due`, and `completed`.
3. Preserve markdown body sections such as `Context`, `Files`, `Criteria`, and `Log`.
4. Derive status:
   - legacy lock exists for the legacy task ID: `active`
   - otherwise `completed` exists: `done`
   - otherwise: `queue`
5. Convert a 3-digit legacy ID to a 4-digit task ID by left-padding (`001` becomes `0001`) when that ID is available.
6. If the padded ID conflicts, allocate the next available 4-digit task ID.
7. Preserve the original ID in `legacy_id`.
8. Record the legacy task path in `legacy_source`.

Derive `work_id` from the migrated task:

```text
YYYY-MM-DD-{task_id}-{slug}
```

Use the legacy `created` date when valid; otherwise use the current date. Build the slug from the title. If the target work directory already exists, allocate a new task ID and recompute `work_id` instead of overwriting.

## Writing Migrated Tasks

For each confirmed migration candidate:

1. Create `.mdf/work/{work_id}/`.
2. Write `.mdf/work/{work_id}/item.md`.
3. Include frontmatter fields:
   - `id`: new 4-digit task ID
   - `task_id`: new 4-digit task ID
   - `legacy_id`: original legacy ID
   - `legacy_source`: absolute legacy task file path
   - `work_id`
   - `kind: "task"`
   - `status`
   - `title`
   - `order`
   - `created`
   - `due` when present
   - `completed` when present
   - `worktree` when an active legacy lock provides one
   - `branch` when an active legacy lock provides one
   - `latest: {}`
4. Preserve the legacy markdown body below the new frontmatter. If the legacy body is missing required item-card sections, add empty `## Context`, `## Files`, `## Criteria`, or `## Log` sections.
5. Append a log line noting the migration date and legacy source.
6. Append or update the latest `.mdf/index.jsonl` entry for the `work_id`.
7. Write a migration report as `.mdf/work/{work_id}/migration-NNN.md`.

Do not overwrite existing canonical work items. Treat every conflict as an allocation problem or a skip with a clear report.

## Lock Migration

Copy legacy locks only when they are valid and correspond to a migrated task.

New lock files live at:

```text
<canonical-root>/.mdf/locks/{task_id}.lock
```

The new lock must include:

- `task_id`: new 4-digit task ID
- `legacy_id`
- `work_id`
- `canonical_root`
- `worktree`
- `branch`
- `started`
- `runtime`

If a legacy lock is malformed or points to a missing worktree, do not write a new lock. Migrate the task as `queue` unless `completed` indicates `done`, and report the skipped lock.

## Migration Report

Each migrated work item gets a report named `migration-NNN.md` containing:

- legacy project store path
- legacy task path
- new item path
- old ID and new task ID
- derived status
- whether a lock was copied
- conflicts or field repairs
- files intentionally left untouched

For `migrate-tasks all`, also summarize all migrated, skipped, and failed projects in the response.

## Safety Rules

- Never delete, move, or rewrite legacy files.
- Never write `.mdf/` when MDF project init is missing.
- Never create an independent `.mdf/` inside a linked worktree.
- Never overwrite existing canonical work items or locks.
- Stop on ambiguous project matching.
- Report every skipped task with the reason.
- Run `git diff --check` after writes when the target is inside a git repository.
