---
name: auto-doubt-driven-development
description: "Recovers automatic DDD-class decisions with progress-based stopping. Use only when an automatic workflow root needs fresh recovery beyond routine executor/critic rework."
---

# Automatic Doubt-Driven Development

MDF-only semantic port for automatic profiles. It does not change standalone
`doubt-driven-development` or its three-cycle stop.

## Public contract

**Input:** a CLAIM and why it matters; the smallest ARTIFACT and CONTRACT; the
current operation; and the relevant persisted executor/critic reports and
handoff evidence.

**Output:** a concise `resolved`, `progress`, `BLOCKED`, or
`needs-user-decision` result with artifact/evidence references and finding
classifications.

**Authority:** only the automatic-workflow root selects this skill, persists
evidence, re-enters an operation, accepts work, or requests a user decision.
Executors, critics, and stage adapters remain mode-blind.

## Recovery

1. **CLAIM:** state the non-trivial decision and why it matters.
2. **EXTRACT:** isolate the smallest reviewable artifact and its contract;
   exclude prior reasoning.
3. **DOUBT:** obtain a distinct fresh read-only adversarial review of
   ARTIFACT + CONTRACT, never the CLAIM. Use the shared dispatch policy.
4. **RECONCILE:** classify each finding as contract misread, valid actionable,
   valid trade-off, or noise against the artifact itself.
5. **PROGRESS:** re-enter the affected existing operation without a numerical
   cap only when a changed artifact or contract, or newly verified evidence,
   materially addresses a substantive finding and the next fresh review can
   assess that changed target.

Return `resolved` only when the fresh adversarial review finds no substantive
issue, or only explicitly harmless/trivial findings. A substantive finding is
not resolved merely because it was already considered; without new relevant
evidence, return `BLOCKED` or `needs-user-decision`. The root still applies the
current operation's normal acceptance criteria.

Do not use this skill for ordinary `changes_requested` executor/critic rework;
the automatic operation contract owns that loop and it is not a DDD cycle.

## Stop and recovery evidence

- Treat a fresh review of an unchanged target or a repeated core finding with
  no new relevant evidence as no progress. Do not repeat the review; return
  `BLOCKED` with the finding and evidence references.
- Stop for an existing material scope, authority, safety, destructive-action,
  or user-owned decision boundary. Request the decision when that is the only
  blocker.
- Record claim, artifact identity, evidence, classifications, and progress
  judgment in the existing persisted role reports and handoff. Do not add a
  recovery schema, controller, counter, or lifecycle state.
- For a returned role report, record a transient provider failure or backoff
  separately in that report and handoff. For a terminal no-report failure,
  follow the automatic operation contract's immutable transport-retry handoff
  rule before retrying. It is neither a quality finding nor a DDD review and a
  later user resume does not discard or reset it.

## Verification

- [ ] CLAIM, ARTIFACT, CONTRACT, fresh adversarial review, and reconciliation
      are recorded.
- [ ] For `progress`, the next review has a materially changed target or new
      verified evidence.
- [ ] Routine critic rework and transport/backoff events were not counted as
      DDD recovery.
- [ ] A terminal no-report transport failure has its immutable handoff evidence
      before any retry.
- [ ] The result is `resolved`, progress, `BLOCKED`, or a precisely requested
      user decision.
- [ ] `resolved` contains no substantive finding, including a repeated one.
