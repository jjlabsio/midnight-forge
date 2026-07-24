---
name: spec
description: "Start spec-driven development — write a structured specification before writing code"
---

# spec

## Upstream command contract

Invoke the spec-driven-development skill.

Begin by understanding what the user wants to build. Ask clarifying questions about:
1. The objective and target users
2. Core features and acceptance criteria
3. Tech stack preferences and constraints
4. Known boundaries (what to always do, ask first about, and never do)

Then generate a structured spec covering all six core areas: objective, commands, project structure, code style, testing strategy, and boundaries.

## MDF adaptation

### Persistence port

Replace the upstream final `SPEC.md` persistence instruction with the next
immutable `.mdf/work/<work-id>/spec-NNN.md`. Preserve the upstream document
content and user-confirmation checkpoint; do not create a divergent `SPEC.md`.

1. Resolve the installed plugin and canonical project roots.
2. Run exact upstream `using-agent-skills` discovery. Load this adapter,
   `spec-driven-development`, and every other applicable primitive it selects.
3. Read the current task, project guidance, decisions, and relevant repository
   state. Stop for unresolved material intent or risk.
4. Apply `<plugin-root>/references/approval-evidence.md` to the exact artifact
   path and SHA-256.
5. Stop after the specification. Planning is a separate invocation.

When delegated, report operation, status, inputs, output path and hash,
findings, assumptions, and blockers. Do not select the next operation, accept
the artifact, advance lifecycle, or grant authority.
