# Keep Model and Freshness Judgment in the Workflow

## Status

Accepted

## Date

2026-07-13

## Context

MDF previously carried adapter and lifecycle machinery that recorded model,
persona, freshness, and semantic decisions in machine-readable sidecars. Those
facts could not prove reasoning quality or genuine context isolation. The
protocol added maintenance cost while duplicating upstream review judgment.

## Decision

The model and applicable upstream skill own model choice, reviewer choice,
freshness judgment, semantic adequacy, downstream impact, recovery, and ship
meaning. Skills state the required checks and confirmation stops in readable
guidance. When a separate reviewer is unavailable, the root reports that
limitation instead of claiming independent freshness.

Packaging validators may verify source bytes, generated equality, and inventory
coverage. They do not assert model quality, lifecycle progress, review
correctness, or user authority.

## Consequences

- Workflow surfaces are shorter and more flexible.
- Human-readable reports explain what ran and what judgment was made.
- Exact artifact approvals, task locks, owned paths, and external confirmation
  remain explicit safety boundaries.
- Review quality depends on following the upstream skill and truthfully stating
  limitations; no script can manufacture semantic certainty.
