# Port automatic DDD recovery to meaningful progress

## Status

Accepted

## Date

2026-07-24

## Context

The pinned upstream DDD primitive and its standalone MDF adapter stop after
three doubt cycles. That bounded stop is preserved for direct use. Automatic
MDF profiles, however, can encounter a DDD-class non-trivial decision while
otherwise-correct executor/critic rework continues to produce new artifacts or
evidence. Applying the standalone stop there would terminate the automatic
profile for elapsed cycles rather than for a loss of decision progress.

Routine automatic executor/critic rework is not DDD: a `changes_requested`
assessment already re-enters the same operation under the automatic operation
contract. Transport failures such as provider `429` responses and backoff are
also not quality findings or decision-review cycles.

## Decision

Add the public MDF-only `auto-doubt-driven-development` skill. Only an
automatic-workflow root selects it for a DDD-class non-trivial decision; stage
adapters remain mode-blind. It preserves DDD's CLAIM, smallest
artifact-plus-contract EXTRACT, adversarial fresh review, and finding
RECONCILE steps.

The root intercepts every DDD-class trigger during an automatic profile and
routes it to this port before a mode-blind stage or executor can enter
standalone DDD. This changes only automatic composition: direct standalone
build and `doubt-driven-development` keep their existing behavior.

The port has no numerical cycle limit. Re-enter the affected operation while a
changed artifact, contract, or newly verified evidence materially addresses a
substantive finding and a fresh review evaluates that changed target. Stop when
an unchanged target is reviewed again, the same core finding repeats without
new relevant evidence, or an existing substantive scope, authority, safety, or
user-owned decision boundary applies. Report `BLOCKED` or request the needed
user decision with the retained evidence; never grind another equivalent
review.

A fresh adversarial review that finds no substantive issue, or only explicitly
harmless/trivial findings, returns `resolved`. A substantive finding does not
become resolved merely because it was already considered; without new relevant
evidence it remains no progress and requires `BLOCKED` or a user decision. This
successful decision outcome is distinct from no-progress `BLOCKED`; it lets the
root continue the operation's normal acceptance process without accepting a
partial or stale artifact.

Record decision-recovery and transport facts in existing immutable role reports
and handoffs. For a terminal transport failure without a returned report, the
root writes the existing immutable handoff before retrying, puts the raw status
in its attempt line and the verbatim response, observed time, and
retry/backoff context in its existing blockers text, then links that handoff in
the terminal observation. It also runs the existing changed-paths helper from
the stage-start commit and records its exact output plus root-observed
verification in that handoff before retrying. The handoff records every
accepted executor/critic field, artifact, and commit as `none`. It neither
fabricates a role report nor adds a new artifact schema. Provider/backoff facts
do not count as a DDD review or reset on a later user resume. No controller,
retry schema, helper, or lifecycle state is added.

The automatic operation contract is the only owner of shared executor/critic
and DDD recovery binding. The selected profile root invokes this skill only for
DDD-class decisions and leaves ordinary executor/critic rework under that
shared binding.

## Trade-off

Progress-based stopping can take more or fewer reviews than a fixed cap. MDF
accepts that variability because a retained changed-target/evidence trail makes
the root's progress judgment reviewable, while a count cannot distinguish a
real repair from repeated non-progress.

## Consequences

- Direct `doubt-driven-development` retains its upstream-compatible
  three-cycle stop condition and vendor source remains unchanged.
- Automatic profiles can continue useful recovery without a global cycle cap,
  but the root must make and record a defensible meaningful-progress judgment.
- The port can spend a variable number of reviews when evidence keeps changing;
  repeated evidence is an explicit stop, not permission for an infinite loop.
