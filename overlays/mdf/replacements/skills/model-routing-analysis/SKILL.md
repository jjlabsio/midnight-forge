---
name: model-routing-analysis
description: "Analyze newly observed MDF subagent invocations and maintain model-efficiency evidence."
---

# model-routing-analysis

Use this repository skill when reviewing the empirical evidence collected for
MDF subagent model and effort routing. It is an analysis workflow, not a
runtime selector, scheduler, controller, or automatic policy updater.

## Resolve the analysis repository

Before reading or writing anything, resolve the plugin repository from the
skill's own source location. Require the same repository to contain
`overlays/mdf/inventory.json` and
`docs/operations/model-routing-analysis.md`. If those anchors cannot be found
from the skill source location, stop and ask the caller to run this repository
skill from the plugin repository. Never fall back to the current working
directory or a registered consumer project for the report write.

The source observations live in each registered project's local, gitignored
MDF state. The analysis report and its checkpoint live in the plugin
repository at:

```text
docs/operations/model-routing-analysis.md
```

Do not mutate any source project's task card, index, lock, worktree, or other
MDF state. Read source projects and write only the plugin-repository analysis
document.

## Scope and schedule

Read `~/.mdf/projects.json` and inspect every registered local project whose
entry has an absolute `canonical_root`. The skill has no internal daily or
weekly schedule. The caller may run it at any frequency; each run analyzes all
new invocation observations added after the previous checkpoint.

If a registry entry is missing, malformed, inaccessible, or no longer owns a
valid `.mdf/project/init.json`, exclude it from the run and disclose the exact
reason in the report. Do not silently replace a registered root with a
similarly named directory or a linked worktree.

## Checkpointed incremental scan

Use the per-project append-only source log:

```text
<canonical-root>/.mdf/observations/subagent-invocations.jsonl
```

The report's `Checkpoint` section stores, for every included or excluded
project, the registry ID, a SHA-256 digest of the normalized canonical-root
identity, the last analyzed source-log line number, a SHA-256 hash of the exact
consumed prefix bytes, the latest run identifier, and the reason when no
observations were available. The root digest is stored instead of the absolute
path. Apply this procedure:

1. Read the previous report and all source-log lines without changing them.
2. Before reusing a checkpoint, compare its stored registry ID and
   canonical-root digest with the current `~/.mdf/projects.json` entry. Compute
   the digest as SHA-256 of the normalized absolute `canonical_root` string,
   but never write that path to the tracked report. If either identity differs,
   the checkpoint is invalid for that project: perform and disclose a full
   rescan.
   If no checkpoint exists, treat the complete available log as the initial
   batch. If the checkpoint is malformed, the line count moved backwards, or
   the SHA-256 of the previously consumed prefix does not match, perform a
   full rescan and disclose the reset instead of guessing what was missed.
3. Select every source-log event after that project's recorded line number.
   Include an invocation when either its dispatch or terminal event is in the
   new range, and load its matching event from the earlier range when needed.
4. Pair events by the exact `invocation_id`. Never infer a pair from model,
   timestamp, task title, branch, or neighboring lines. Duplicate dispatches,
   duplicate terminals, terminal-before-dispatch events, conflicting statuses,
   or conflicting timestamps are malformed observations: retain them in the
   report as malformed/insufficient evidence and exclude them from efficiency
   comparisons. A dispatch without a terminal event remains an
   incomplete/censored observation.
5. Advance the checkpoint only after the current batch has been analyzed and
   the plugin report has been written. A failed report write must not be
   described as a successful checkpoint.

The source log is an observation stream, not a truth database. Preserve raw
values exactly. Do not normalize model aliases, effort labels, timestamps, or
statuses before storing the raw observation. The exact requested pair is the
cohort key.

## Raw observation contract

Accept only the minimal facts defined by the dispatch policy:

- `invocation_id`
- `requested_model`
- `requested_effort`
- `status`
- `dispatched_at` and, when present, `completed_at`
- fixed `purpose` (`workflow` or `analysis`) and existing `work_id` linkage
- project-relative `artifact_refs`

Do not add or reconstruct orchestrator model/effort, host-reported actual
model/effort, task-factor judgments, routing rationale, prompts, responses,
manual review fields, secrets, or absolute local paths. If a required raw
field is missing or malformed, retain the observation as invalid or
insufficient evidence and say why.

`purpose: analysis` observations are kept for provenance but excluded from
workflow model-efficiency cohorts. A missing or unknown purpose is not
silently treated as workflow; place it in an explicitly unknown cohort.

## Artifact and outcome evidence

For each newly observed invocation, inspect the invocation and its linked
result artifacts together. Read every safe, project-relative path in
`artifact_refs`, including changed-file summaries, test results, review or
validation records, and shipped-outcome records when those artifacts are
actually linked. Before opening any artifact, enforce these per-invocation
limits: at most 32 artifact references, at most 1 MiB per regular file, and
at most 8 MiB total bytes across that invocation's artifacts. Reject
directories, non-regular files, and artifacts that exceed these limits;
disclose the omitted evidence instead of reading an unbounded blob.

Reject absolute paths, traversal, symlink escapes, unreadable paths, and
links outside the registered canonical root. Do not search nearby files and
pretend that they are linked evidence. If the terminal event has no reliable
artifact link, or the linked artifact does not contain enough evidence to
support an outcome, record `unknown` or `insufficient evidence` explicitly.

Keep these layers separate in the report:

1. **Raw observation** — the exact recorded dispatch/terminal facts.
2. **Artifact evidence** — the linked files read and the objective signals
   they contain, with relative references.
3. **Retrospective interpretation** — an inferred task shape, outcome signal,
   rework signal, and confidence, always labeled as inference.
4. **Routing insight** — a cautious comparison or recommendation, never an
   automatic model-policy change.

An LLM interpretation is not ground truth. Prefer explicit verification,
review, changed-file, test, and shipped-result evidence. When evidence
conflicts, report the conflict and abstain from a stronger conclusion.

## Time and efficiency analysis

When both observed timestamps are valid, derive:

```text
observed dispatch-to-return time = completed_at - dispatched_at
```

Do this only during analysis. Never add a duration calculation to normal
workflow execution or treat this interval as pure model execution time. A
failed, timed-out, interrupted, or otherwise censored invocation may retain an
observed interval, but its quality outcome is not successful merely because a
completion timestamp exists. Do not sum durations for parallel invocations.

Compare exact `requested_model` + `requested_effort` pairs using descriptive
statistics only when the evidence supports them. Keep terminal failures,
timeouts, missing terminals, unknown outcomes, and insufficient-evidence
records visible. Separate unlike inferred task shapes when possible, but do
not present retrospective task classification as a recorded fact.

Account for the main confounders in every meaningful comparison: task mix,
novelty, risk, required quality, verification strength, rework, parallelism,
sample size, and censoring. A small or unbalanced cohort can support a
directional observation only; it cannot prove that one model or effort caused
the difference or is universally better.

The one-person-builder objective is time-to-acceptable-core-value at an
acceptable quality floor, not maximal code perfection. Where artifacts
support it, report speed, rework, verification, and core-value signals
together. Do not invent product-value evidence when the artifacts do not
contain it.

## Analysis model and provenance

Use the strongest currently available model and native effort setting for
retrospective semantic synthesis. If the analysis delegates that synthesis,
follow the central dispatch policy, use `purpose: analysis`, and record the
requested model/effort pair and the delegated invocation reference in the
plugin report. If the root performs the synthesis, record root-context
synthesis without inventing a model or effort value. Never use a host runtime
return value as evidence of the model or effort.

Every run records its analysis provenance: run timestamp, source-project
registry snapshot, included/excluded project counts, source-log watermarks,
new invocation count, evidence limitations, and the requested analysis
dispatch pair when one was explicitly selected. This provenance describes the
analysis operation; it is not an orchestrator observation.

Generate a readable run ID from the UTC run timestamp plus a short unique
suffix (for example, `analysis-20260719T120000Z-a1b2`). The run ID identifies
the report checkpoint only; it is not a model identity or runtime value.

## Maintained report

Update `docs/operations/model-routing-analysis.md` after analyzing the batch.
Keep the document readable and structured with these sections:

- `Method and evidence policy`
- `Analysis provenance`
- `Checkpoint` — registry ID, one prefix watermark/hash, and
  inclusion/exclusion reason per registered project
- `Run history` — one concise entry per analysis run, including no-op runs,
  resets, and report-write failures
- `Raw observations` — new exact model/effort/status/timestamp counts, with
  analysis-purpose rows separated
- `Artifact evidence and inferred outcomes` — evidence references, explicit
  unknown/insufficient-evidence rows, confidence, and any conflicts
- `Model and effort comparisons` — descriptive observations with sample sizes,
  durations, rework/verification signals, and confounders
- `Routing insights` — cautious proposals for future routing experiments; no
  automatic policy change

Use project names and project-relative artifact identifiers in the tracked
report. Do not copy raw prompts, worker responses, secrets, or absolute local
paths into it. Preserve older findings and checkpoint history in the same
document so the report remains an auditable record.

If there are no new invocations, write a no-new-observations run entry with
unchanged watermarks rather than pretending that the prior batch was new. If
the run is blocked by an inaccessible registry or report path, record the
failure only when the plugin report can be written; otherwise stop and report
the unrecorded failure to the caller.

## Completion boundary

The skill is complete only when the new batch has been inspected, linked
artifacts have been checked, elapsed intervals have been derived where valid,
unknown evidence has been disclosed, the plugin report and checkpoint have
been updated, and all source projects remain unchanged. It does not schedule
itself, edit `subagent-dispatch-policy.md`, alter the routing reference, or
change future model selection automatically.
