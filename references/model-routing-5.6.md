# GPT-5.6 Model Routing Reference

Readable guide for MDF-managed subagents. It is not a runtime selector or
script-enforced model contract.

## Inputs

Before selection:

1. Consult `model-routing-performance.md` as a qualitative cost/intelligence
   prior, not a capability guarantee.
2. Assess task difficulty, risk, ambiguity, novelty, consequence, required
   quality, runtime capability, and transport compatibility.
3. Use runtime-native model and reasoning settings; MDF does not enumerate or
   normalize the effort vocabulary.

## Default

- Use a currently available GPT-5.6 family profile for quality-critical work.
- Select executor and distinct critic independently.
- Require both to meet the operation's root-selected quality floor.
- Treat topology as no substitute for capability.
- Treat persona model settings as direct-invocation defaults; MDF-managed root
  selection overrides them without expanding persona authority.

## Availability exclusions

- Exclude every GPT-5.6 Luna profile from MDF-managed subagent selection.
- Do not request Luna for an executor, critic, specialist, or exploration worker.
- Treat Luna entries in `model-routing-performance.md` as observational context,
  not selectable candidates.
- Select among suitable non-Luna candidates using the normal routing criteria.
- Do not interpret this runtime-availability exclusion as evidence that Luna is
  unsuitable for the work.

Remove the exclusion only after subagent runtime compatibility is verified and
this reference is explicitly updated.

## Exploration exception

Use exact model `gpt-5.3-codex-spark` at its highest supported reasoning setting
only when all are true:

- narrow codebase exploration;
- read-only, report-only output;
- no design, implementation, testing, review, security, lifecycle, or external
  authority;
- compatible Spark transport is available.

Spark cannot serve as an automatic executor or critic.

## Fallback

1. If Spark is unavailable or incompatible, use a suitable read-only GPT-5.6
   fallback.
2. If none is available, let the root perform exploration and record degradation.
3. For quality-critical work, stop when no suitable reviewed capability exists.

A root self-review or degraded fallback is not an independent critic.

## Record

In the root dispatch note, record:

- requested model and effort;
- qualitative selection rationale and performance-reference context;
- capability confidence and uncertainty;
- read/write authority;
- fallback, degraded, or blocked status.

## Prohibited

- `fast` or speed-only profiles;
- fixed stage-to-model tables or benchmark calculators;
- benchmark equivalence claims;
- silent use of older or unreviewed future model families;
- silent downgrade;
- requesting a Luna profile while the availability exclusion is active;
- treating the requested model as the model that actually executed.

Model selection remains root AI judgment, not a lifecycle controller.
