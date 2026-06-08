---
name: spec
description: "Use when the user invokes spec, mdf spec, or asks to start spec-driven development by writing SPEC.md before implementation."
---

# spec

Use this Codex-native entrypoint when the user invokes `spec`, `mdf spec`, `$spec`, or asks to start spec-driven development.

Before drafting a spec, consult the `interview-me` skill's existing `When to
Use` criteria as the source of truth for initial intent clarity. If those
criteria apply, use `interview-me` first and continue only after its intent
restate has been explicitly confirmed. If they do not apply, proceed directly:
Invoke the `spec-driven-development` skill.

`interview-me` owns whether the user's initial intent is clear enough to write a
spec. `spec-driven-development` owns the later quality gate for whether the
drafted spec is concrete enough to plan and build from.

Begin by understanding what the user wants to build. Ask clarifying questions about:
1. The objective and target users
2. Core features and acceptance criteria
3. Tech stack preferences and constraints
4. Known boundaries (what to always do, ask first about, and never do)

Then generate a structured spec covering all six core areas: objective, commands, project structure, code style, testing strategy, and boundaries.

Before saving or presenting the spec, run the inline blocker-oriented self-review loop from `spec-driven-development`. Revise only for issues that would cause flawed planning; do not block on wording polish, stylistic preferences, or nice-to-have additions.

Save the spec as `.mdf/work/{work_id}/spec-NNN.md` by default, using the current MDF work item resolution rules. If the user explicitly asks for a repo-level reviewed spec, save the spec as SPEC.md in the project root and confirm with the user before proceeding.

Stop before implementation. Ask whether to proceed to planning only after the user has reviewed the saved spec artifact. If the user explicitly requested a repo-level spec, refer to `SPEC.md`; otherwise refer to `.mdf/work/{work_id}/spec-NNN.md`.
