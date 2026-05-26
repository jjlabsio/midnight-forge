---
name: spec
description: "Use when the user invokes spec, mdf spec, or asks to start spec-driven development by writing SPEC.md before implementation."
---

# spec

Use this Codex-native entrypoint when the user invokes `spec`, `mdf spec`, `$spec`, or asks to start spec-driven development.

Invoke the `spec-driven-development` skill.

Begin by understanding what the user wants to build. Ask clarifying questions about:
1. The objective and target users
2. Core features and acceptance criteria
3. Tech stack preferences and constraints
4. Known boundaries (what to always do, ask first about, and never do)

Then generate a structured spec covering all six core areas: objective, commands, project structure, code style, testing strategy, and boundaries.

Save the spec as `.mdf/work/{work_id}/spec-NNN.md` by default, using the current MDF work item resolution rules. If the user explicitly asks for a repo-level reviewed spec, save the spec as SPEC.md in the project root and confirm with the user before proceeding.

Stop before implementation. Ask whether to proceed to planning only after the user has reviewed SPEC.md.
