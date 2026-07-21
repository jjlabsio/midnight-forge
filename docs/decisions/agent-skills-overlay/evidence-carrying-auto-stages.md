# Require Evidence-Carrying Two-Key Automatic Stages

## Status

Accepted

## Date

2026-07-21

## Context

MDF's automatic modes reduce repeated user prompts, but their root still tends
to execute specification, planning, implementation, and assessment work in the
same growing context that owns intent and authority. Existing MDF policy also
makes delegated workers report-only. That preserves a simple ownership model
but prevents automatic workflows from isolating semantic stage work and its
verification from the root context.

The pinned upstream lifecycle intentionally uses user-driven checkpoints and
keeps personas flat. MDF cannot describe a different automatic actor model as
upstream-identical. It needs an explicit, narrow port that preserves each
stage's work, order, quality gates, completion meaning, fallback behavior, and
stop conditions.

## Decision

For `auto-workflow`, `auto-workflow-pr`, and `quick-workflow-pr`, every
model-led stage that the mode actually runs uses an evidence-carrying mandatory
Two-Key gate:

1. One bounded producer or primary assessor executes the exact canonical MDF
   stage and every applicable primitive selected through the exact upstream
   `using-agent-skills` discovery workflow.
2. One distinct fresh-context, read-only verifier assesses the same canonical
   artifact, diff, or release target from root-observed state and evidence,
   without producer reasoning and without delegation.
3. The root independently reconciles actual state and both keys into only
   `PASS`, `REWORK`, or `BLOCKED`.

A mutating automatic stage may grant its producer one bounded write lease over
exact artifact or source paths. The root remains the sole owner of intent,
authority, stage selection, canonical task/card/lock/handoff state, artifact
acceptance, commits, lifecycle transitions, external mutations, and final
synthesis. There is never more than one active writer in a shared worktree.

This decision ports two upstream/MDF realization details only inside the three
automatic modes:

- intermediate user checkpoints become mandatory independent model gates;
- root-only artifact/source writing becomes one bounded producer lease.

Standalone MDF and pinned upstream behavior is unchanged. The upstream-identical
`references/orchestration-patterns.md`, `docs/agents.md`, and vendor files stay
unchanged and remain authoritative outside the scoped automatic-mode port.

The plugin-installed automatic-workflow contract and dispatch policy are the
runtime authority for this port. They must define positive writer terminality,
root observation of canonical and Git state, complete verifier inputs, dynamic
GPT-5.6 quality floors for both keys, maximum-three-cycle recovery, and
unattended verified-success-or-blocked completion. They remain readable
model-led guidance, not a controller or machine-only protocol.

## Alternatives Considered

### Keep all stage work in the root

Rejected because it preserves the context-growth mechanism this change is
intended to remove and makes independent verification optional.

### Delegate report-only analysis while the root writes

Rejected as the automatic-mode default because the root still repeats the
semantic stage work and absorbs its implementation detail.

### Add a workflow runtime or hard-coded router

Rejected because it would hide semantic decisions, duplicate upstream
workflows, and violate MDF's thin, model-led harness.

## Consequences

- Automatic stages incur at least two model contexts and may cost more or take
  longer, but the topology cannot be removed for cheaper execution.
- Model capability remains dynamic and efficiency-aware, while both keys must
  meet the stage's required quality floor.
- Missing, failed, incomplete, non-fresh, or non-terminal keys fail closed.
- Quick mode still omits spec, plan, simplification, and ship; omissions do not
  create empty gates.
- Static and packaging validation can prove authored coverage and provenance,
  not runtime dispatch, model quality, or measured context reduction.
