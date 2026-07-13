# Use Generated Runtime Files

## Status

Accepted

## Date

2026-07-08

## Context

Midnight Forge vendors upstream `agent-skills` and applies MDF-specific model
guidance. Agents need to consume skills during normal execution without
mentally composing upstream files, overlay metadata, and local policy fragments.

## Decision

Commit complete generated files under root `skills/`, `references/`, and
`agents/`. Treat `vendor/agent-skills` plus `overlays/mdf` as source inputs and
use packaging scripts to regenerate and validate the installed surface.

## Alternatives Considered

### Runtime overlay composition

- Pros: Less duplicated generated content in the repository.
- Cons: Every agent would need to understand overlay composition before using a skill.
- Rejected: Normal skill execution should read complete files.

### Directly edit upstream-derived skill files

- Pros: Simple in the short term.
- Cons: Hides MDF changes inside upstream content and makes future upstream updates risky.
- Rejected: MDF behavior must be separated from the upstream snapshot.

## Consequences

- Generated files duplicate source-derived content.
- Packaging sync and validation are required before PRs.
- Future agents can read ordinary runtime files without overlay knowledge.
- Upstream update work can compare pinned source, overlay metadata, and generated output.
