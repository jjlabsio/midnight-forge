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

`item.md` is the source of truth for a work item. `index.jsonl` is a derived
read model, not an independent state store. Normal task lifecycle changes
append a current projection, but task and board skills also run an AI-led
self-healing preflight. The preflight reads cards and locks first, normalizes
legacy rows (rows without `schema_version` are version 0), and automatically
compacts the index when the authoritative state is unambiguous. New projections
use the current schema version. A recovery copy may be kept before a rewrite;
cards and their history are never rewritten by index maintenance.

Malformed historical index rows alone do not stop a task or board operation.
Malformed cards, duplicate task IDs, conflicting current locks, unknown future
schema versions, or ambiguous tombstones stop only the affected operation; a
multi-project board continues with other unambiguous projects. No separate
repair command, runtime migration, or per-repository migration is required.

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
path and SHA-256 values bind integrity and freshness to the autonomous execution
envelope; they are not human permission. A revision invalidates earlier
evidence. `build` follows TDD, focused verification, task-owned
staging, readable review, downstream-impact judgment, and one focused commit.
The model chooses the next ready task and explains ambiguity.

`auto-workflow` adds a local run-scoped orchestration policy. Before `spec`, it
must invoke `interview-me` when required intent fields are missing, materially
different interpretations exist, an unsurfaced assumption or conflicting goal
remains, confidence is below 95%, or the user explicitly requests an
interview. A clear mechanical request skips the interview. After intent is
settled, the root may carry the same run through spec, plan, build/test,
review, simplification, and local commit without ceremonial approval prompts.
It does not ship, complete the whole task, push, or create/update a PR.
`auto-workflow-pr` is the former full auto workflow: it resumes local work,
finishes pending plan slices when needed, uses the full spec as its acceptance
baseline even when no plan work remains, then runs ship, completes the whole
MDF task after ship GO, and performs push and PR create/update. Exact artifact
hashes, TDD, review, lock, and high-risk checks remain required; changed
artifacts invalidate downstream authorization. Merge, deploy, deletion,
stale-lock takeover, and unresolved critical or no-progress conditions still
stop.

`quick-workflow-pr` is the explicit lightweight delivery path for small
documentation or implementation changes. It always skips spec and plan,
reuses the canonical build, review, and GitHub PR skills, returns to build for
actionable review findings, and does not invoke code simplification or ship.
Its acceptance baseline is the user request, active task Context, current
scope, and verification evidence. The canonical quality and external-action
guards remain in force.

Research and report-only review fan-outs may run in parallel. Writer tasks may
run in parallel only when a mechanical proof gate establishes dependency-free
tasks, normalized disjoint paths, no shared contracts/generated outputs or
global state, isolated worktrees and locks on the same base, and an explicit
independence review. Unknown or failed proof falls back to serial execution.
The root remains responsible for merging, verification, and lifecycle state.

Plan-slice completion and whole-task completion are separate: a local build
commit records an implementation slice while the MDF card remains active until
the PR-capable final handoff. Review has two readable scope labels:
`lifecycle-review` for a full delegated tree and `task-review` for a direct
task/diff check. A completed task can be
reviewed read-only after its lock is released. `review_mode` is descriptive,
not a permission to mutate state; a task review cannot create lifecycle
evidence or promote itself to ship.

## Autonomous authority and artifacts

Workflow artifacts are local by default:

```text
<canonical-root>/.mdf/work/{work_id}/{artifact-type}-NNN.md
```

Authority is a human-readable task/handoff contract tied to the exact artifact
revision and SHA-256. The digest proves identity and freshness, not permission.
Do not infer artifact integrity from existence, a review pass, or a green
command. Missing, stale, ambiguous, or out-of-envelope authority is a
`BLOCKED` stop without an approval prompt. See
[references/approval-evidence.md](../../references/approval-evidence.md) and
[references/mdf-preserved-contract.md](../../references/mdf-preserved-contract.md).

## Recovery and historical state

Task and board entrypoints perform bounded, reversible index self-healing as
part of their normal preflight. The AI reconstructs projections from
authoritative cards, locks, and clearly identifiable tombstones, keeps a local
recovery copy before rewriting the derived index, re-reads the result, and
continues only when the result is unambiguous. It never guesses a current card
state from an incomplete historical row and never rewrites or deletes card
history.

If the authoritative state is ambiguous, the affected task operation stops with
an actionable warning. Project and user board scans isolate the affected item or
project and continue elsewhere. Scope changes, repeated no-progress,
destructive actions outside the current envelope, or unverifiable external
effects stop as `BLOCKED`. Technical revisions create fresh spec and plan
revisions.

Historical `.mdf/work/` artifacts are read-only evidence of prior work and are
not rewritten or deleted by packaging cleanup. The current card, lock, branch,
and worktree facts are reconciled before deleting maintained code.

## Related decisions

- [Use canonical project-root task storage](../decisions/mdf-task-system/canonical-project-root-storage.md)
- [Use the MDF docs taxonomy](../decisions/docs/mdf-docs-taxonomy.md)
