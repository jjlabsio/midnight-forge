# Use the MDF Docs Taxonomy

## Status

Accepted

## Date

2026-07-08

## Context

The repository had a small `docs/superpowers/` tree with historical implementation plans and specs. Those files referenced obsolete storage paths, Claude command shims, and early Superpowers workflows. The project now needs durable tracked docs that match MDF's fallback documentation convention.

## Decision

Use root `docs/` with these areas:

```text
docs/index.md
docs/product/index.md
docs/product/product-brief.md
docs/architecture/index.md
docs/decisions/index.md
docs/operations/index.md
```

Place durable decisions under:

```text
docs/decisions/<area-or-design-unit>/<decision-slug>.md
```

Delete `docs/superpowers/` after important current decisions are recaptured in product, architecture, and decision docs.

## Alternatives Considered

### Keep `docs/superpowers/` as historical archive

- Pros: Preserves old planning detail.
- Cons: Agents may treat obsolete instructions as current.
- Rejected because only durable decisions should remain in tracked docs.

### Store decisions beside implementation files

- Pros: Local to code.
- Cons: Project-wide workflow decisions cut across generated files, overlays, and scripts.
- Rejected for project-wide MDF decisions.

## Consequences

- New tracked docs have clear indexes.
- Historical plans are removed instead of maintained as current documentation.
- `.mdf/project/docs-profile.*` can cache this taxonomy as high-confidence interpretation.
