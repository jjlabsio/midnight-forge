# Model Routing Analysis

This document is the durable analysis and checkpoint record for MDF-managed
subagent routing. Raw invocation observations remain in each registered
project's gitignored `.mdf/observations/subagent-invocations.jsonl`; this
tracked document contains evidence summaries, cautious interpretations, and
the incremental-analysis watermarks.

## Method and evidence policy

The `model-routing-analysis` skill reads every registered local MDF project
from `~/.mdf/projects.json` and analyzes only invocation events added after
the previous per-project checkpoint. It reads each invocation together with
its explicitly linked result artifacts. Missing, unsafe, stale, or inadequate
links are reported as `unknown` or `insufficient evidence`; they are never
filled from neighboring files or model assumptions.

Raw requested model/effort facts, artifact evidence, retrospective
interpretations, and routing insights remain separate. Dispatch-to-return
time is derived from the recorded dispatch and completion timestamps during
analysis. It is not pure model execution time, and parallel durations are not
summed.

Comparisons are descriptive observations over exact requested model/effort
pairs. They account for task mix, quality floor, verification strength,
rework, censoring, and sample size. They do not prove causality or change the
dispatch policy automatically. The one-person-builder objective is
time-to-acceptable-core-value at an acceptable quality floor.

## Analysis provenance

No analysis run has been completed yet. The first invocation of
`model-routing-analysis` must record its run timestamp, registry snapshot,
included and excluded projects, source-log watermarks, new invocation count,
analysis dispatch provenance when applicable, and evidence limitations below.
Run IDs should use the UTC timestamp plus a short unique suffix and identify
the report checkpoint only; they are not model identities or runtime values.

Analysis-purpose workers are retained for provenance but excluded from normal
workflow efficiency cohorts. The report must never contain raw prompts,
worker responses, secrets, host-reported actual model/effort values, or
absolute local paths.

## Checkpoint

No source-log watermark exists yet. On the first run, create one row for every
registered project, including projects with no observation log or an explicit
exclusion reason. Thereafter, preserve the prior rows and update each row only
after the corresponding new batch has been analyzed and this document has
been written successfully.

| Registry ID | Project | Canonical-root SHA-256 | Source log | Last analyzed line | Consumed-prefix SHA-256 | Last run | New invocations | Inclusion / exclusion reason |
| --- | --- | --- | --- | ---: | --- | --- | ---: | --- |
| — | — | — | — | — | — | — | — | Initial checkpoint pending |

## Run history

No analysis run has been recorded yet. Append one concise entry per run,
including no-op runs, full-rescan resets, excluded-project changes, and any
report-write failure that prevented a checkpoint from advancing.

## Raw observations

No invocation batch has been analyzed yet. Future entries must preserve the
exact `requested_model`, `requested_effort`, status, purpose, timestamps, and
invocation identity from source observations without normalizing aliases or
effort labels.

## Artifact evidence and inferred outcomes

No artifact evidence is available yet. Future entries must identify the
project-relative linked artifacts that were actually read, state objective
signals from those artifacts, and label any task-shape or outcome statement
as an inference with confidence and evidence references.

## Model and effort comparisons

No comparison is available until observations with linked evidence exist.
Small or unbalanced cohorts must remain directional only; failed, timed-out,
interrupted, incomplete, and insufficient-evidence observations remain visible.

## Routing insights

No routing recommendation is available yet. Analysis may propose future
experiments or routing hypotheses, but a human-reviewed policy change remains
outside this report and outside the analysis skill's authority.
