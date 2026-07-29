# Historical Task 0041 Mechanization Inventory

> Historical record only. This describes the task-0041 store that task 0103
> replaced. It is not an operational contract. Current task storage is defined
> by [MDF Task System](mdf-task-system.md) and the active task-store skill.

## Decision

Task 0041 removed broad scripted workflow orchestration because ordinary LLM
judgment is flexible enough for routing, approval, review, downstream impact,
and recovery. The maintenance cost of a large script surface exceeded the
benefit of making these semantic decisions deterministic.

Its then-maintained boundary was:

- Model-led MDF skills for task interpretation, canonical state decisions,
  approvals, workflow routing, review, simplification, ship, GitHub handoff,
  and cleanup confirmation.
- Canonical project-root `.mdf/` cards, rebuildable index projections,
  persistent locks, readable Markdown artifacts, and project-local worktrees.
- Packaging-only sync, inventory, and validation scripts.
- Narrow factual helpers only: lock inspect/acquire/release, single-write
  observation append, and changed-path rendering. They record observable state
  and never select workflow operations, judge acceptance, or advance lifecycle.
- One aggregate helper validator runs the focused observation and changed-path
  behavior tests from the repository's standard verification checklist.

## Classifications

### Active at task 0041

Active maintained surfaces are the task, initialization, worktree, routing,
definition, planning, build, review, simplification, ship, and GitHub skill
inputs and their generated outputs. Their owner is the model-led workflow in
task 0041 and the applicable upstream primitive.

### Historical

Historical `.mdf/work/` cards, Markdown artifacts, index rows, locks from
completed work, and decision records remained readable. Their producer or old
format was not an active dependency in that version. The old task and board
skills could compact the derived index during automatic self-healing; this is
retired behavior and must not be restored.

### Packaging

Packaging surfaces are `vendor/agent-skills`, `overlays/mdf/inventory*`,
`overlays/mdf/release-metadata.json`, the sync renderer, and the two retained
source/overlay validators. They establish generated-file consistency only;
they do not make semantic workflow decisions.

## Disposition by former area

| Former area | Disposition | Owner after task 0041 |
| --- | --- | --- |
| Task/index/card orchestration | Removed from scripts; preserved in readable task skills | Model + canonical `.mdf` contracts |
| Init/worktree/artifact/Git cleanup helpers | Removed from scripts; preserved as direct skill checklists | Model + ordinary Git commands |
| Spec/plan/build/review/ship lifecycle gates | Removed from scripts; preserved as Markdown approvals and handoffs | Model + upstream skills |
| Controller/runtime/evidence/adapter validators | Removed in T8 | None; historical artifacts remain readable |
| Narrow lock operations | Retained in T7 | `scripts/mdf-lock.js` only (retired by task 0103) |
| Factual workflow evidence | Added after T7; no semantic decisions | Skill-local observation, changed-path, and post-merge GitHub facts helpers |
| Sync/port/inventory checks | Retained and simplified in T6 | Packaging boundary |

## Explicit exclusions

Queued task plans 0038–0040 and unrelated cards are outside this inventory and
were not inspected, reindexed, locked, completed, dropped, or rewritten.
