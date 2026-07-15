# Product Brief

## One-Liner

Midnight Forge (`mdf`) is a Codex plugin harness that gives solo developers local task management and agent-skills workflows through a generated Codex skill bundle.

## Current Stage

The project is in v1. It is Codex-only and focuses on reliable local workflows, generated skill surfaces, and machine-verifiable overlay reproduction.

## Target Users

- Solo developers using Codex for software development workflows.
- Future maintainers and agents that need clear local task state, skill routing, and decision context.

## Problem

Agent workflows need durable local state, consistent task lifecycle rules, and reusable skills without forcing agents to mentally compose upstream instructions with project-specific changes at runtime.

## Promise

Midnight Forge provides a local-first MDF workflow system and a complete generated Codex skill surface that can be validated from source inputs.

## Core Use Case

A developer initializes MDF, creates or starts a task, works in an isolated git worktree, saves workflow artifacts under `.mdf/work/{work_id}/`, verifies changes, and prepares a GitHub PR through MDF skills.

## Current Scope

- Codex plugin packaging.
- MDF init, task, task board, migration, worktree, commit, PR, and cleanup skills.
- Vendored upstream `agent-skills` source under `vendor/agent-skills`.
- MDF overlays under `overlays/mdf`.
- Generated runtime files under root `skills/`, `references/`, and `agents/`.
- Validation scripts for generated output and port semantics.

## Out Of Scope

- Claude Code plugin support.
- MCP servers, background runners, model orchestration, or hosted services.
- Runtime composition of upstream files plus overlays.
- Sharing `.mdf/` workflow state through git.

## Key Workflows

- `init` prepares local MDF state and ignore setup.
- `task` manages local work items and task locks.
- `auto-workflow` coordinates local spec, plan, build, review, simplification,
  and commit work.
- `auto-workflow-pr` resumes that work through ship and GitHub PR preparation.
- `sync-agent-skills.js` regenerates runtime skill files from vendor and overlay inputs.
- `validate-agent-skills-sync.js` and `validate-agent-skills-port.js` verify the generated surface.

## Success Signals

- Generated runtime files are reproducible from pinned source inputs.
- Agents can use root skill files without reading overlay internals during normal task execution.
- MDF task artifacts stay local by default.
- Important architecture and workflow decisions are captured in tracked docs.

## Differentiation

Midnight Forge treats skill instructions themselves as the product surface, while keeping upstream source, MDF modifications, and generated runtime files explicitly separated and validated.

## Constraints

- The generated runtime surface must stay complete and directly consumable by Codex.
- `.mdf/` state is local and gitignored.
- Upstream-derived behavior must be traceable to pinned vendor source and overlay metadata.
- Protected agent-skills surfaces remain byte-identical; MDF-specific behavior
  is expressed through separate model-led skill and packaging inputs.

## Open Questions

- How future upstream additions should be classified into protected primitives
  or MDF-native model-led guidance.
- Whether release metadata should eventually move to a dedicated generated version source.
- Which upstream additions should be adopted in the next upstream update workflow.

## Related Docs

- [Agent Skills Overlay System](../architecture/agent-skills-overlay-system.md)
- [MDF Task System](../architecture/mdf-task-system.md)
- [Generated Runtime Files Decision](../decisions/agent-skills-overlay/generated-runtime-files.md)
