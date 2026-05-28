---
name: plan
description: "Use when the user invokes plan, mdf plan, or asks to break SPEC.md into read-only implementation tasks in tasks/plan.md and tasks/todo.md."
---

# plan

Use this Codex-native entrypoint when the user invokes `plan`, `mdf plan`, `$plan`, or asks to break an existing spec into tasks.

Invoke the `planning-and-task-breakdown` skill.

Read the existing spec (SPEC.md or equivalent) and the relevant codebase sections. Then:

1. Enter plan mode — read only, no code changes
2. Identify the dependency graph between components
3. Slice work vertically (one complete path per task, not horizontal layers)
4. Write tasks with acceptance criteria and verification steps
5. Add checkpoints between phases
6. Present the plan for human review

Before saving or presenting the plan, run the blocker-oriented evaluator/revision loop from `planning-and-task-breakdown`. Revise only for issues that would cause flawed implementation; do not block on wording polish, stylistic preferences, or nice-to-have additions.

Save the plan to `.mdf/work/{work_id}/plan-NNN.md` by default, using the current MDF work item resolution rules. If the user explicitly asks for repo-level planning files, save the plan to tasks/plan.md and task list to tasks/todo.md.
