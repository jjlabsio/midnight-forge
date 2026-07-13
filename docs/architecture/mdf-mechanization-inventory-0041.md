# Task 0041 Mechanization Inventory

## Decision

Task 0041 removes broad scripted workflow orchestration because ordinary LLM
judgment is flexible enough for routing, approval, review, downstream impact,
and recovery. The maintenance cost of a large script surface exceeded the
benefit of making these semantic decisions deterministic.

The final maintained boundary is:

- Model-led MDF skills for task interpretation, canonical state decisions,
  approvals, workflow routing, review, simplification, ship, GitHub handoff,
  and cleanup confirmation.
- Canonical project-root `.mdf/` cards, append-only index projections, locks,
  readable Markdown artifacts, and project-local worktrees.
- Packaging-only sync, inventory, and validation scripts.
- One narrow lock helper for inspect, exclusive acquire, and byte-conditional
  release.

## Classifications

### Active

Active maintained surfaces are the task, initialization, worktree, routing,
definition, planning, build, review, simplification, ship, and GitHub skill
inputs and their generated outputs. Their owner is the model-led workflow in
task 0041 and the applicable upstream primitive.

### Historical

Historical `.mdf/work/` cards, Markdown artifacts, index rows, locks from
completed work, and decision records remain readable. Their producer or old
format is not an active dependency. They are not rewritten or deleted by this
task.

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
| Narrow lock operations | Retained in T7 | `scripts/mdf-lock.js` only |
| Sync/port/inventory checks | Retained and simplified in T6 | Packaging boundary |

## Explicit exclusions

Queued task plans 0038–0040 and unrelated cards are outside this inventory and
were not inspected, reindexed, locked, completed, dropped, or rewritten.
