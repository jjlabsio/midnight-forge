---
name: task
description: "Manage one local MDF task's intent and current lifecycle state."
---

# task

Resolve the plugin root and read `<plugin-root>/references/mdf-preserved-contract.md`.
Task intent remains in `.mdf/work/{work_id}/item.md`; machine state is exactly
`.mdf/work/{work_id}/task.json`. Do not create an index, lock, tombstone,
recovery record, migration, resume path, or controller.

## Preflight

Resolve the canonical root from `.mdf/project/init.json`, then resolve one
four-digit task ID by its current `task.json`. Require its adjacent `item.md`.
Use this helper for factual reads and atomic replacement guarded by the exact
full-content digest returned by `inspect`:

```bash
node <plugin-root>/skills/task/scripts/task-store.mjs <canonical-root> inspect <task-id>
```

Pass that digest to every mutation. The helper rejects a changed status or any
other changed task content, so a lifecycle update cannot erase newer execution
facts.

Helper output is facts, not authority. Stop for malformed state, duplicate IDs,
missing intent, unsafe paths, unresolved hard dependencies, or unrelated dirt.

`task.json` has version `1`, `task_id`, `work_id`, `title`, `status`, `order`,
`created`, `depends_on`, and only the execution facts actually known (for
example `worktree`, `branch`, `started`, `latest.pr`). Status is one of
`queue`, `active`, `done`, or `cancelled`.

## Operations

| Invocation | Action | End state |
| --- | --- | --- |
| create or queue | Write self-contained `item.md` and current `task.json`; no branch or worktree. | `queue` |
| `task <id> set` | The only queue-to-active operation. Load `using-git-worktrees`, prepare the branch/worktree, then atomically replace queue state with active execution facts and stop. | `active` |
| `task <id> cancel` | Atomically replace current state with `cancelled`. Keep the directory, intent, artifacts, branch and worktree facts. | `cancelled` |
| `github-after-merge` | After its merged-PR checks, atomically replace active state with `done`. | `done` |

`set` is not generic field setting. There is no `work`, `resume`, `drop`, lock
acquisition/release, index append, repair, cleanup, or runtime migration.
Task does not select or authorize downstream work.

## Intent

Start `Context` with the triggering request verbatim and retain the existing
self-contained intent rules, `Files`, `Criteria`, `Evidence`, and `Log`
headings. `item.md` never duplicates lifecycle authority; current state belongs
only in `task.json`. Keep `.mdf` out of source commits.
