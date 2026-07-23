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

## Decision

Use two explicit planes.

### Stage plane

- Keep command adapters mode-blind and close to their pinned upstream command.
- Preserve standalone inputs, order, skills, outputs, checkpoints, fallback,
  completion, and stop conditions.
- Limit MDF adaptation to Codex discovery, canonical artifact storage, task
  safety, and a concise stage report.
- An executor returns its invocation, inputs, outputs, verification, findings,
  and blockers. The root persists that report and adds changed paths rendered
  by a small Git helper for mutating automatic stages from the root-supplied
  baseline. The executor does not calculate or claim Git scope; the helper
  never selects the next operation or grants authority.
- Stage adapters do not load the automatic-workflow contract.

### Workflow plane

- The root entrypoint selects one readable workflow profile and owns stage
  order, omissions, automatic checkpoint substitution, recovery, commits,
  lifecycle state, and external actions.
- Automatic `spec`, `plan`, and each `build` slice run in bounded skill-backed
  executor subagents. The root observes the actual artifact or diff before a
  fresh read-only critic assesses that target.
- The root alone accepts a result and chooses the next operation. Executor and
  critic reports are evidence, not authority.
- Keep one writer in a shared worktree. A critic never receives executor
  reasoning as its review target.
- Wait for every dispatched subagent's actual terminal response. A caller-side
  wait timeout, no update, or elapsed silence is not terminal or failure
  evidence: while the subagent remains running, keep waiting, never interrupt it
  merely for slowness or silence, and never dispatch a replacement writer
  before the prior writer is terminal.
- When a critic requests changes, rework the actual target and dispatch a fresh
  critic; repeat until accepted or an existing substantive stop condition
  blocks progress. Raw executor or critic dispatch count alone never causes
  `BLOCKED`.
- Use actual artifact bytes, Git state, command results, and commit OIDs as
  evidence. After each accepted operation, write an immutable canonical root
  handoff that links every executor and critic attempt to its role-specific
  report and links the accepted executor result to its artifact or commit. This
  evidence survives branch and worktree deletion. Record each attempt on one
  deterministic role-specific line so later analysis can link an invocation to
  exactly one report without parsing prose. Keep each handoff concise and
  revalidate actual state on resume.

### Build lifecycle

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
step to the root. The binding must remain explicit in the workflow contract;
the stage adapter itself remains unchanged. These substitutions do not weaken
the upstream acceptance or verification criteria.

## Consequences

- Stage adapters remain independently usable and easier to compare with
  upstream updates.
- Automatic behavior is reviewable in one profile rather than reconstructed
  from many skills.
- Independent review remains mandatory at operations that advance authority,
  without a universal stage-internal Two-Key protocol.
- Root orchestration still costs extra subagent contexts, but avoids nested
  delegation and repeated policy prose.
- This decision supersedes
  [`evidence-carrying-auto-stages.md`](evidence-carrying-auto-stages.md).
