# MDF Preserved Contracts

## Canonical root and current tasks

- Resolve the canonical root from `.mdf/project/init.json`; linked worktrees
  use that root's `.mdf/` store.
- Every live task has `.mdf/work/{work_id}/item.md` and adjacent version-1
  `task.json`. Intent and artifacts remain in the work directory.
- `task.json` is the only lifecycle authority. It holds one current state, not
  an append history. Helper writes use atomic replacement with an expected
  current status.
- Boards invoke the helper read-only and do not initialize, repair, migrate,
  inspect artifacts, parse legacy state, or write MDF files.

## Lifecycle

- `task <id> set` alone changes queue to active after worktree preparation and
  records branch/worktree facts. It is not generic field setting.
- `task <id> cancel` only writes `cancelled` and retains the directory and all
  recorded facts. No work, resume, drop, tombstone, lock, recovery, or cleanup
  lifecycle exists.
- Post-merge finalization changes active to done only after its own GitHub and
  completion verification.

## Intent and authority

- `item.md` retains the triggering request, material resolved context,
  accepted proposal, interpretation, evidence, delegated judgment, unresolved
  facts, Files, Criteria, and Log. It does not duplicate current lifecycle
  state.
- Creation normalizes compact `delivery: merge` in `item.md`; omitted delivery
  is `pr`. Delivery is intent only: it neither selects a workflow nor grants
  authority. `task.json` retains only current lifecycle and execution facts.
- Task state and artifacts are evidence, not reusable authority. The skill
  performing an action owns current target, safety, verification, and stop
  checks. Reject unsafe paths, malformed current state, duplicate IDs, and
  unresolved dependencies.
