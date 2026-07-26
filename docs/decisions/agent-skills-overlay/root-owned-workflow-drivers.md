# Use Root-Owned Workflow Drivers

## Status

Accepted

## Date

2026-07-22

## Context

Automatic-mode rules had spread into `spec`, `plan`, `build`, `test`,
`review`, `code-simplify`, and `ship`. Each adapter interpreted MDF modes,
repeated dispatch and evidence rules, and described its place in the lifecycle.
The adapters grew into a second workflow implementation and drifted from both
the pinned commands and each other. In particular, simplification moved into
the per-slice loop even though the architecture places it after whole-build
review.

A later solo-operated workflow run exposed a second failure mode: technically
valid critic findings accumulated into stronger guarantees and task-specific
infrastructure beyond the accepted outcome. The root treated review findings
as rework authority instead of binding them to the current delivery, while
re-reading the target broadly enough to become another critic.

## Decision

Use two explicit planes.

### Stage plane

- Keep command adapters mode-blind and close to their pinned upstream command.
- Preserve standalone inputs, order, skills, outputs, checkpoints, fallback,
  completion, and stop conditions.
- Let each called stage adapter load the fixed and conditional upstream
  primitives required by its own public contract. The root does not perform
  whole-profile discovery or preselect a later stage's primitive set.
- Limit MDF adaptation to Codex discovery, canonical artifact storage, task
  safety, and a concise stage report.
- An executor returns its invocation, inputs, outputs, verification, findings,
  and blockers. The root persists that report and adds changed paths rendered
  by a small Git helper for mutating automatic stages from the root-supplied
  baseline. The executor does not calculate or claim Git scope; the helper
  never selects the next operation or grants authority.
- Stage adapters do not load automatic operation or profile contracts.

### Workflow plane

- The root entrypoint selects one readable workflow profile and owns stage
  order, omissions, automatic checkpoint substitution, recovery, commits,
  lifecycle state, and external actions.
- Automatic `spec`, `plan`, and each `build` slice run in bounded skill-backed
  executor subagents with the exact stage adapter. The called adapter resolves
  its own primitives. The root observes the actual artifact or diff before a
  fresh read-only critic assesses that target.
- The root alone accepts a result and chooses the next operation. Executor and
  critic reports are evidence, not authority.
- A critic owns technical review. For an actionable finding in an automatic
  operation, it identifies the evidence, affected currently supported path,
  the accepted criterion or existing invariant it claims is violated—or that
  no current binding exists—and a bounded repair candidate or why repair
  exceeds the current scope. The root checks target identity, freshness, and
  cited evidence, then decides only current-delivery disposition and repair
  authority. It does not independently search for defects, reproduce the
  review, reassess severity, or design the repair.
- Keep one writer in a shared worktree. A critic never receives executor
  reasoning as its review target.
- Wait for every dispatched subagent's actual terminal response. A caller-side
  wait timeout, no update, or elapsed silence is not terminal or failure
  evidence: while the subagent remains running, keep waiting, never interrupt it
  merely for slowness or silence, and never dispatch a replacement writer
  before the prior writer is terminal.
- A critic request is not rework authority. Rework the actual target only when
  the automatic operation contract's `fix-now` proof gate grants a bounded
  repair, then dispatch a fresh critic. After rework, continue only when the
  accepted guarantee remains unmet; a newly proposed stronger guarantee does
  not expand the current delivery. An executor stops for user scope authority
  rather than implementing beyond its granted repair boundary. Raw executor or
  critic dispatch count alone never causes `BLOCKED`.
- Use actual artifact bytes, Git state, command results, and commit OIDs as
  evidence. After each accepted operation, write an immutable canonical root
  handoff that links every executor and critic attempt to its role-specific
  report and links the accepted executor result to its artifact or commit. This
  evidence survives branch and worktree deletion. Record each attempt on one
  deterministic role-specific line so later analysis can link an invocation to
  exactly one report without parsing prose. Keep each handoff concise and
  revalidate actual state on resume.

### Build lifecycle

An accepted automatic plan slice is one complete build executor, critic, and
root-commit operation. Accept the fewest bounded vertical slices that preserve
meaningful independent acceptance, verification, and recovery. A separate
slice boundary must be earned by an independently accepted user or operational
outcome, isolation of a materially distinct implementation risk, or a
dependency checkpoint whose failure should stop later work. Do not split work
only by file, architectural layer, helper, test category, small commit, or
implementation order; coalesce adjacent work that serves the same accepted
outcome and meaningful verification boundary. Do not create a monolithic slice
that obscures an earned boundary merely to reduce dispatches.

For each approved plan slice:

```text
build executor -> root observation -> slice critic -> root commit
```

Actionable findings return to the same slice. Do not run simplification inside
this loop.

After every slice is committed:

```text
whole-build verification -> whole-build review -> one simplification pass
-> root observation -> simplification critic -> root simplification commit
```

The simplification critic checks behavior preservation and the resulting diff.
Any changed behavior or failed verification returns to the earliest affected
build operation. An empty simplification pass creates no commit.

### Ship

Preserve the pinned `ship` command: the root invokes its three independent
specialists in parallel and performs the main-context merge. Do not wrap ship
in another executor, verifier, or coordinator.

### Automatic call-site ports

The root operation binding may substitute an automatic critic for an upstream
human checkpoint and may defer an upstream stage's commit or task-completion
step to the root. The binding must remain explicit in the automatic operation
contract;
the stage adapter itself remains unchanged. These substitutions do not weaken
the upstream acceptance or verification criteria.

## Consequences

- Stage adapters remain independently usable and easier to compare with
  upstream updates.
- Automatic behavior is reviewable in one profile rather than reconstructed
  from many skills.
- Independent review remains mandatory at operations that advance authority,
  without a universal stage-internal Two-Key protocol.
- Technical review remains independent while current-delivery disposition and
  bounded repair authority stay root-owned.
- Root orchestration still costs extra subagent contexts, but avoids nested
  delegation and repeated policy prose.
- This decision supersedes
  [`evidence-carrying-auto-stages.md`](evidence-carrying-auto-stages.md).
