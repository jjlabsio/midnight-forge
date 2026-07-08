# Use Canonical Project-Root Task Storage

## Status

Accepted

## Date

2026-06-08

## Context

MDF task state must be shared across the canonical checkout and project-local linked worktrees. Earlier designs used `~/.mdf/projects/{project-hash}` as the primary task store, but that made worktree coordination and project-local state harder to reason about.

## Decision

Store project task state under the canonical project root `.mdf/` directory. Use `~/.mdf/projects.json` only as a registry of known local projects.

## Alternatives Considered

### Primary global project-hash storage

- Pros: Keeps all task state outside repositories.
- Cons: Harder to inspect per-project state and coordinate linked worktrees.
- Rejected in favor of canonical project-root `.mdf/` storage.

### Per-worktree `.mdf/` storage

- Pros: Isolated by checkout.
- Cons: Splits one project task board across worktrees.
- Rejected because task state should be project-level, not worktree-level.

## Consequences

- `.mdf/` must be gitignored.
- Linked worktrees read and write the canonical root `.mdf/`.
- MDF init owns ignore setup before other task skills mutate project state.
- Workflow artifacts remain local unless explicitly promoted into tracked docs.
