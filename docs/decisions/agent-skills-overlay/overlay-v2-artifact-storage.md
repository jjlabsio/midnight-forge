# Keep Artifact and Task State Readable

## Status

Accepted

## Date

2026-07-13

## Context

Workflow artifacts and task state need a predictable local home, but a large
scripted storage protocol makes ordinary work rigid and expensive to maintain.
The upstream primitive should remain byte-identical, while MDF guidance needs
to explain where cards and artifacts live.

## Decision

Keep canonical project state under `<canonical-root>/.mdf/` and readable
workflow artifacts under `.mdf/work/{work_id}/`. `item.md` is the card source
of truth and `index.jsonl` is an append-only projection. Exact spec and plan
approvals name the Markdown path and SHA-256. Model-led skills write and
explain these artifacts; packaging scripts only render and validate generated
files.

## Consequences

- Worktree isolation does not create a second `.mdf` store.
- Historical cards and artifacts remain readable.
- Generated root files are produced from explicit overlay inputs.
- A narrow lock helper may protect ownership bytes, but it does not own
  artifacts, approvals, lifecycle, review, or external actions.
