# MDF Task System

## Purpose

MDF provides a local, LLM-driven work item system for Codex workflows. It records task state, locks, and workflow artifacts without requiring an MCP server, CLI helper, event store, background runner, or hosted service.

## Storage Model

Canonical project state lives under the repository root:

```text
<canonical-root>/.mdf/
  project.json
  project/init.json
  index.jsonl
  work/
  locks/
```

The global `~/.mdf/projects.json` file is only a lightweight registry. It is not the primary task store.

Linked worktrees under `<canonical-root>/.worktrees/<branch>` use the canonical root `.mdf/` directory. They do not create independent `.mdf/` state.

## Work Item Kinds

- `task`: executable work with queue, active, and done lifecycle.
- `note`: durable non-executable context.
- `track`: a grouping outcome for related work.

Legacy `inbox` and `routine` items may be read for compatibility but are not first-class new item kinds.

The task board entrypoints are `tasks-project` for the current project and `tasks-user` for registered local projects.

## Task Lifecycle

`task work {id}` resolves an exact task ID, validates dependencies, runs staleness preflight, prepares an isolated worktree, writes a lock, and updates the task card to active.

Implementation requires a separate explicit instruction after activation unless the same user message already names a downstream workflow.

`github-pr` completes exactly the session-identified task before PR creation by using task completion behavior and deleting the lock.

Standalone `$task work <id>` briefs the task and stops. A same user message can name an explicit downstream workflow, and that explicit downstream workflow may continue after task activation.

## Workflow Model

The normal MDF workflow is:

```text
spec -> plan -> build -> review -> ship
```

`spec`, `plan`, and `build` use inline loops by default. `test` and `review` are still standalone quality tools for independent verification, manual changes, debugging, PR preparation, and pre-ship checks.

`auto-workflow` delegates each phase and stops when a delegated phase needs a real decision, returns a blocking question, cannot complete its gate, returns NO-GO, or hits a git/PR ambiguity. Prompts classified as review checkpoint only or artifact saved confirmation can be auto-proceeded only after the required artifact exists, the blocker-oriented review loop has passed, and no planning-blocking question remains.

High-risk work has heavier gates by design. During planning, every approved SPEC requirement is classified as `normal` or `high-risk` by semantic judgment. During build, task artifacts include Task Acceptance Traceability and final build artifacts include Whole-Build Spec Traceability. When a plan contains high-risk requirements, build must pass a mandatory high-risk independent review before claiming completion.

Subagent-assisted evaluator, build, or review modes require both explicit current-user authorization and runtime tool availability.

Example: if a spec requires a continued DB-backed job to be reselected within the same bounded scheduler invocation, evidence that only verifies persisted `continued` state is insufficient.

## Init and PR Preparation

`init` owns setup for local workflow-state ignore rules. If `.mdf/` or `.worktrees/` ignore setup needs a PR, `init` delegates setup PR push/create/update mechanics to `github-pr` through the narrow MDF init setup PR mode.

PRs are ready for review by default.

## Staleness and Downstream Impact

Queued task cards are checked for semantic drift before work starts. The staleness preflight runs before branch/worktree creation, lock mutation, task state changes, implementation edits, tests, commits, or other implementation side effects.

When task work changes design, architecture, contracts, workflow semantics, task boundaries, or shared acceptance assumptions, MDF runs a downstream impact check against remaining planned work, queued task cards, and related context. Shared files alone do not create hard dependencies, and `depends_on` remains only for true hard blockers.

## Artifact Storage

Workflow artifacts are local by default:

```text
<canonical-root>/.mdf/work/{work_id}/{artifact-type}-NNN.md
```

Tracked project docs under `docs/` are reserved for durable shared documentation that the user explicitly wants committed.

## Historical Notes

Earlier Superpowers-era documents described primary storage under `~/.mdf/projects/{project-hash}` and Claude command shims. Those details are obsolete. Current behavior is defined by `skills/task/SKILL.md`, `skills/tasks-project/SKILL.md`, `skills/tasks-user/SKILL.md`, and related generated MDF skills.

## Related Decisions

- [Use canonical project-root task storage](../decisions/mdf-task-system/canonical-project-root-storage.md)
- [Use the MDF docs taxonomy](../decisions/docs/mdf-docs-taxonomy.md)
