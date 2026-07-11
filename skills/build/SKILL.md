---
name: build
description: "Use when the user invokes build or asks to implement approved MDF plan work with upstream TDD and review gates."
---

# build

This controller preserves the upstream build workflow while providing MDF
canonical artifacts and orchestration. Resolve the installed plugin root before
loading any path. Load and follow exact upstream
`../incremental-implementation/SKILL.md`, `../test-driven-development/SKILL.md`,
and `../code-review-and-quality/SKILL.md`; MDF does not edit their criteria.

## Selection and task gate

A standalone `build` processes exactly one selected or next pending task from
the exact approved plan revision. It does not claim whole-build completion.
Use upstream incremental implementation when its trigger conditions apply and
always apply appropriate upstream TDD/verification.

Before a focused commit, the root controller must save task evidence and obtain
a passing fresh-context upstream code review against the canonical full spec,
full plan, task evidence, relevant sources, diff, and verification results. The
task then passes its downstream-impact gate: actionable findings are fixed and
re-reviewed while material progress continues; repeated blocker, verification
regression, no progress, or a user decision stops the loop. Only then create
one commit per task.

From the resolved plugin root, use the production
`./scripts/mdf-controller.js build-task` operations for the gate. Pass JSON on
stdin with resolved `--cwd` and `--plugin-root`:

- `select`: approved `plan_registration_file`, optional ready
  `selected_task_id`, and the root `writer_id`; requires a clean baseline and
  returns exactly one task attempt.
- `verify`: `attempt_file`, a shell-free `command` argv array, and canonical
  work-item `output_path`; the runtime executes it in the worktree and records
  the actual exit code and output.
- `impact`: `attempt_file`, an allowed downstream-impact `classification`, and
  the raw `artifact_path`.
- `authorize`: the attempt, passing `command_files`, exact fresh review output
  and decision, task evidence, diff, downstream-impact decision, exact
  `touched_paths`, and intended `commit_subject`. This must run before staging
  or committing.
- After authorization, stage only the returned task paths and create the one
  focused commit. Then call `complete` with `authorization_file`; completion is
  recorded only when runtime-computed parent, tree, subject, paths, and clean
  status match the authorization.

Never infer completion from prose, a review verdict alone, or the existence of
a commit. A failed controller operation is a typed stop for the build loop.

Fresh review requires a capability-verified independent executor. If that is
unavailable, use the permitted root escalation and record it; otherwise record
the upstream-defined degraded status and block commit/advancement whenever
genuine freshness is required. A generic subagent receives the exact selected
upstream persona prompt, not a paraphrase.

## `build auto` and `build all`

`build auto` and `build all` are public lifecycle modes. Route them to the
flat root `auto-workflow` controller, which processes all approved plan tasks;
do not reinterpret them as one standalone task. Preserve upstream autonomous
behavior: clean baseline checks, known approved inputs, separate planning
commit(s), task-only staging, one commit per task, resume semantics, and
high-risk or irreversible-work sign-off stops.

Before lifecycle execution, resolve approved spec/plan evidence and run
`git status --porcelain`; stop for any unrelated dirt. If a promoted tracked
planning artifact is uncommitted, create its preparatory planning commit before
task work; canonical local `.mdf` artifacts remain evidence, not tracked
planning files. Before each task, recheck a clean baseline, stage only the
enumerated task-touched paths with `git add -- <paths>` (never `git add -A`),
commit the one passed task, and resume only at the next canonical pending task.

After all approved plan tasks pass, the lifecycle controller runs whole-build
integration verification and a separate fresh-context upstream review. Whole
build completion is calculated against all approved plan tasks, never merely
the selected task.
