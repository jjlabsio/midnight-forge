# Replace Artifact Storage Rules With MDF Storage

## Status

Accepted

## Date

2026-07-08

## Context

Many upstream skills create workflow artifacts. In MDF, workflow artifacts should be local task evidence under `.mdf/work/{work_id}/` unless explicitly promoted into tracked project docs. Keeping upstream tracked-file storage instructions alongside MDF storage instructions creates conflicting guidance.

## Decision

For artifact-storage-only skills, render from pinned upstream source and replace upstream artifact persistence instructions with the MDF artifact storage rule. Use overlay v2 `fragment` entries with explicit anchors and exact patches where upstream text names a tracked path.

Artifact-storage-only generated skills must not retain upstream tracked storage paths such as `docs/`, `SPEC.md`, `tasks/plan.md`, or `tasks/todo.md`.

## Alternatives Considered

### Full-file replacements

- Pros: Easy to express current behavior.
- Cons: Repeats whole upstream files and hides upstream improvements.
- Rejected for artifact-storage-only skills because the change is narrow.

### Add MDF storage instructions without removing upstream storage instructions

- Pros: Smaller implementation.
- Cons: Produces conflicting instructions when upstream names tracked paths.
- Rejected because MDF storage should be authoritative for workflow artifacts.

## Consequences

- `api-and-interface-design` receives an MDF contract storage rule even though upstream has no tracked storage path to remove.
- `idea-refine` and `interview-me` replace their upstream `docs/...` persistence text with `.mdf/work/{work_id}/...` paths.
- Validation fails if artifact-storage-only generated files keep tracked storage paths.
- Future tracked docs behavior must be modeled as a separate explicit overlay or MDF-native workflow rule.
