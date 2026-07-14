# MDF Task System

## Purpose

MDF provides a local, model-orchestrated work-item system for Codex. It keeps
task cards, locks, readable artifacts, and Git worktree facts in the project
root without requiring an MCP server, hosted service, background runner, or
broad workflow runtime.

## Storage model

Canonical project state lives under the repository root:

```text
<canonical-root>/.mdf/
  project.json
  project/init.json
  index.jsonl
  work/
  locks/
```

The global `~/.mdf/projects.json` file is only a lightweight registry. A
linked worktree under `<canonical-root>/.worktrees/<branch>` reads the
canonical root `.mdf/` directory and never creates independent state.

`item.md` is the source of truth for a work item. `index.jsonl` is an
append-only read model: read the card first, then use the latest valid line for
board rendering. Malformed cards, invalid index rows, path escapes, and
conflicting facts stop the current operation.

## Task lifecycle and ownership

Task cards use queue, active, and done states. A task is ready only when its
dependencies and current card state permit it. The task skill resolves the
exact task ID, confirms the canonical root, and records the complete card
before appending one complete index projection.

Locks associate a task with its canonical work item, worktree, and branch. A
lock conflict is a stop; stale recovery is never automatic. The owner must
confirm the current task/worktree/branch facts and use the narrow lock
procedure for acquisition and byte-conditional release. Lock bytes do not
authorize semantic bypasses, card deletion, unrelated staging, or external
actions.

The task skill also supports a completed-task read-only handoff. It does not
invoke `done` or mutate the task card when the task is already complete. The
GitHub PR skill has two handoff paths: it completes an incomplete current task
through the task skill, or validates an already-completed task from persisted
worktree and branch facts without recreating a lock. GitHub is the source of
truth for whether an open PR already exists.

## Workflow model

The standalone workflow is:

```text
spec -> plan -> build tasks -> whole-build review -> simplify -> ship -> github-pr
```

`spec`, `plan`, and `review` save readable Markdown artifacts. Exact artifact
path and SHA-256 approvals are human decisions; a revision invalidates the
earlier approval. `build` follows TDD, focused verification, task-owned
staging, readable review, downstream-impact judgment, and one focused commit.
The model chooses the next ready task and explains ambiguity.

`auto-workflow` adds a run-scoped orchestration policy. Before `spec`, it
must invoke `interview-me` when required intent fields are missing, materially
different interpretations exist, an unsurfaced assumption or conflicting goal
remains, confidence is below 95%, or the user explicitly requests an
interview. A clear mechanical request skips the interview. After intent is
settled, the root may carry the same run through spec, plan, build/test,
review, simplification, ship, commit, push, and PR create/update without
ceremonial approval prompts. Exact artifact hashes, TDD, review, lock, and
high-risk checks remain required; changed artifacts invalidate downstream
authorization. Merge, deploy, deletion, stale-lock takeover, and unresolved
critical or no-progress conditions still stop.

Research and report-only review fan-outs may run in parallel. Writer tasks may
run in parallel only when a mechanical proof gate establishes dependency-free
tasks, normalized disjoint paths, no shared contracts/generated outputs or
global state, isolated worktrees and locks on the same base, and an explicit
independence review. Unknown or failed proof falls back to serial execution.
The root remains responsible for merging, verification, and lifecycle state.

Review has two readable scope labels: `lifecycle-review` for a full approved
tree and `task-review` for a direct task/diff check. A completed task can be
reviewed read-only after its lock is released. `review_mode` is descriptive,
not a permission to mutate state; a task review cannot create lifecycle
evidence or promote itself to ship.

## Approval and artifacts

Workflow artifacts are local by default:

```text
<canonical-root>/.mdf/work/{work_id}/{artifact-type}-NNN.md
```

Approval is a human-readable note tied to the exact artifact revision and
SHA-256. Do not infer approval from artifact existence, a review pass, or a
green command. See [references/approval-evidence.md](../../references/approval-evidence.md)
and [references/mdf-preserved-contract.md](../../references/mdf-preserved-contract.md).

## Recovery and historical state

Failures are reproduced and recorded in readable notes before a repair. A
bounded, reversible, task-owned repair can return through TDD and review;
scope changes, ambiguity, repeated no-progress, destructive actions, or
external effects stop for the user. Technical revisions create fresh spec and
plan revisions.

Historical `.mdf/work/` artifacts are read-only evidence of prior work and are
not rewritten or deleted by packaging cleanup. The current card, lock, branch,
and worktree facts are reconciled before deleting maintained code.

## Related decisions

- [Use canonical project-root task storage](../decisions/mdf-task-system/canonical-project-root-storage.md)
- [Use the MDF docs taxonomy](../decisions/docs/mdf-docs-taxonomy.md)
