# MDF Task System

## Purpose

MDF provides a local, LLM-orchestrated work item system for Codex workflows. It records task state, locks, and workflow artifacts without requiring an MCP server, event store, background runner, or hosted service.

Mechanical task-state operations are moving into the deterministic local script `scripts/mdf-task-state.js`. The LLM keeps responsibility for user intent, handoff-quality context and criteria, semantic staleness checks, downstream impact checks, and user-facing explanation.

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

The first deterministic CLI slice supports:

```text
scripts/mdf-task-state.js validate --json
scripts/mdf-task-state.js board --project --json
scripts/mdf-task-state.js board --user --json
scripts/mdf-task-state.js resolve --task-id <id> --json
scripts/mdf-task-state.js add --kind task --title <title> --context-file <file> --json
scripts/mdf-task-state.js done <id> --message <message> --json
```

The CLI treats `item.md` as the source of truth, appends `index.jsonl` entries, keeps lock files as ownership markers, emits typed JSON errors, and uses low-risk atomic writes for item cards.

`task work {id}` resolves an exact task ID, validates dependencies, runs staleness preflight, prepares an isolated worktree, writes a lock, and updates the task card to active.

Implementation requires a separate explicit instruction after activation unless the same user message already names a downstream workflow.

`github-pr` completes exactly the session-identified task before PR creation by using task completion behavior and deleting the lock.

Standalone `$task work <id>` briefs the task and stops. A same user message can name an explicit downstream workflow, and that explicit downstream workflow may continue after task activation.

## Workflow Model

The automatic MDF workflow is:

```text
spec -> plan -> build tasks -> whole-build review -> simplify -> ship -> github-pr
```

`spec`, `plan`, and `review` are standalone one-phase workflows. A standalone
`build` processes exactly one selected or next pending approved plan task.
`build auto` and `build all` are routed to the flat root lifecycle controller,
which processes every approved plan task and preserves clean-baseline,
task-only-staging, focused-commit, resume, and upstream sign-off rules.

`auto-workflow` stops after spec and plan until the user explicitly approves the
exact canonical artifact revision/hash. Revisions invalidate approval. It is
the single writer and root-only synthesizer; persona or generic-subagent work is
bounded reporting, selected by verified capability with an honest root fallback.

Typed human-decision stops preserve their append-only evidence. Once the user
resolves a resumable stop, the root calls `mdf-controller lifecycle resume`,
which returns to the same phase and re-enters that phase's normal gate. It does
not permit a phase jump or a blind retry of stale or malformed state.

Every task uses applicable upstream TDD/verification and then a fresh-context
upstream review of the full canonical context. Actionable findings are fixed and
re-reviewed while progress is material; repeated blockers, regressions,
no-progress, or required user judgment stop the loop. Whole-build verification
and review occur only after every task in the approved plan revision completes.

After a stable whole-build baseline, automatic execution always performs the
production-code simplification scan. A changed candidate receives its own gate
and commit and returns through whole-build verification and fresh review. A
verified no-change result reuses the exact final-tree whole-build review instead
of repeating a standalone review. Standalone `review` remains independently
callable. Ship GO then creates a provenance-bound handoff to the existing
`github-pr` workflow. MDF does not duplicate that workflow's commit, push,
task-completion, or PR mechanics.

MDF preserves upstream risk matrices, doubt-driven review, Definition of Done,
and irreversible-work sign-off. It has no separate evaluator personas or MDF
semantic high-risk protocol.

Production runtime architecture, evidence trust boundaries, and the two
intentional orchestration exceptions are defined in
[Agent Skills Overlay System](agent-skills-overlay-system.md). This task-system
document applies that policy to canonical work items rather than redefining it.

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
