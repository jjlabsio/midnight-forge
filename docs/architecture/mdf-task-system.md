# MDF Task System

MDF keeps local task intent and artifacts without an index, lock service,
controller, background process, or migration runtime. The canonical root owns:

```text
<canonical-root>/.mdf/
  project.json
  project/init.json
  work/{work_id}/
    item.md
    task.json
    <artifacts>
```

`item.md` preserves self-contained user intent, provenance, Files, Criteria,
Evidence, and Log. `task.json` is the single current machine-state record
(version, identity, title, status, ordering/dependencies, and current execution
facts). Neither file is a historical event stream. Linked worktrees read and
write the canonical root store.

Task creation normalizes compact `delivery: merge` into `item.md`; omitted
delivery is `pr`. Delivery is task intent, not lifecycle or execution state:
it neither selects a workflow nor grants action authority. Initially only
`quick-workflow-pr` consumes `merge`, after its ordinary verified-PR gate and
a fresh GitHub-policy validation; it then uses the existing post-merge
finalizer rather than introducing another lifecycle path.

`tasks project` and `tasks user` call the small task-store helper to obtain
current facts. They are read-only: no index rebuild, repair, legacy parsing,
migration, artifact scan, or cleanup occurs while rendering a board.

`task <id> set` is the sole queue-to-active transition. It prepares an isolated
branch/worktree and atomically records those facts in `task.json`, then stops.
`task <id> cancel` changes only status to `cancelled`; it retains its directory,
intent, artifacts, branch, and worktree facts. There is no work, resume, drop,
tombstone, persistent lock, or recovery lifecycle. GitHub post-merge
finalization records `done` in the same current state after its independent
verification.

After that successful `done` transition, `github-after-merge` best-effort
fast-forwards any already-checked-out, clean local default-branch worktree to
the fetched `origin/<default-branch>` tip before it loads `github-clear-gone`.
It uses only an explicit fast-forward-only operation: no checkout, reset,
rebase, force-update, or discarded change is permitted. A missing, dirty, or
non-fast-forwardable worktree, or a synchronization failure, is reported as
skipped or partial cleanup and never reopens the completed task. This local
synchronization is finalizer-only; `github-clear-gone` remains standalone and
does not mutate task state.

Artifacts remain at `<canonical-root>/.mdf/work/{work_id}/` and historical
artifacts remain readable. Legacy state is archived operationally during the
cutover; the shipped runtime does not read or migrate it.
