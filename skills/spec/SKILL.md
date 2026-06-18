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

## Invocation Modes

**Standalone mode** applies when the user invokes `spec`, `mdf spec`, `$spec`,
or otherwise asks only for a spec. In standalone mode, save the spec artifact,
then stop before implementation or planning. Ask whether to proceed to planning
only after the user has reviewed the saved spec artifact.

**Auto-workflow mode** applies when `spec` is delegated from `auto-workflow` in
the same auto-workflow invocation. In auto-workflow mode, keep the same
`interview-me` preflight and blocker-oriented self-review/evaluator loop, but
after a spec artifact is saved and no `question needed`, planning-blocking open
question, or required user decision remains, return control to `auto-workflow`
so it can proceed to planning automatically. Do not treat this auto-proceed as
permission to skip `interview-me` when its existing criteria apply.

Begin by understanding what the user wants to build. Ask clarifying questions about:
1. The objective and target users
2. Core features and acceptance criteria
3. Tech stack preferences and constraints
4. Known boundaries (what to always do, ask first about, and never do)

Then generate a structured spec covering all six core areas: objective, commands, project structure, code style, testing strategy, and boundaries.

Before saving or presenting the spec, run the inline blocker-oriented self-review loop from `spec-driven-development`. Revise only for issues that would cause flawed planning; do not block on wording polish, stylistic preferences, or nice-to-have additions.

Save the spec as `.mdf/work/{work_id}/spec-NNN.md` by default, using the current MDF work item resolution rules and init verification. If init state is missing, stop and instruct the user to run `mdf init`. If the user explicitly asks for a repo-level reviewed spec, save the spec as SPEC.md in the project root and confirm with the user before proceeding.

In standalone mode, stop before implementation. Ask whether to proceed to planning only after the user has reviewed the saved spec artifact. If the user explicitly requested a repo-level spec, refer to `SPEC.md`; otherwise refer to `.mdf/work/{work_id}/spec-NNN.md`.

In auto-workflow mode, do not stop only for artifact saved confirmation or a
review checkpoint only prompt after the blocker-oriented loop has passed.
Instead, report the saved artifact to `auto-workflow` and continue the same
auto-workflow invocation. Still stop for `interview-me`, `question needed`,
missing required information, failed verification, malformed MDF state, or any
decision required from the user.
