# Model Routing Analysis Checkpoint Contract

Path:

```text
.mdf/analysis/model-routing/checkpoint.json
```

Use `schema_version: 8`, `method_version: 10`, and status `included` or
`excluded`.

## Shape

```json
{
  "schema_version": 8,
  "method_version": 10,
  "projects": [
    {
      "registry_id": "<stable ~/.mdf/projects.json id>",
      "canonical_root_sha256": "<64 lowercase hex characters>",
      "status": "included",
      "consumed_line_count": 0,
      "consumed_prefix_sha256": "<sha256 of the exact consumed prefix>",
      "latest_run_id": "<analysis-run-id>",
      "pending_linked_invocations": [
        {
          "invocation_id": "<globally unique invocation ID>",
          "work_id": "<safe linked work ID>",
          "state": "missing_attempt_index | checker_invalid | missing_report | insufficient_outcome",
          "first_pending_run_id": "<analysis-run-id>",
          "latest_run_id": "<analysis-run-id>"
        }
      ],
      "reason": null
    }
  ]
}
```

## Project entry

- Sort `projects` by `registry_id`.
- Hash the normalized absolute registry `canonical_root` string into
  `canonical_root_sha256`; never store the path.
- Count physical JSONL lines, including malformed lines.
- Hash exact consumed UTF-8 bytes, including line endings.
- Use the SHA-256 of empty bytes for an empty prefix.
- Treat a non-newline-terminated final log line as invalid for incremental
  reuse; disclose and full-scan.
- Sort `pending_linked_invocations` by `invocation_id`; require each ID and
  work ID to be non-empty single-line safe values, each state to be one of the
  four controlled values above, and no duplicate invocation IDs. A missing,
  malformed, or duplicate pending entry invalidates incremental reuse and
  requires a full scan.

| Project state | Status | Count/hash | Reason |
| --- | --- | --- | --- |
| Valid, no observation log | `included` | zero / empty-prefix hash | `no_observation_log` |
| Invalid or inaccessible registration | `excluded` | zero / empty-prefix hash | concise cause |

Never silently drop a registered project.

## Reuse decision

Reuse a project watermark only when every check passes:

| Check | Pass | Fail |
| --- | --- | --- |
| Schema and method versions match | Continue | Full scan |
| Registry ID and canonical-root hash match | Continue | Full scan |
| Current line count is at least consumed count | Continue | Full scan |
| Exact consumed-prefix hash matches | Process remaining lines | Full scan |

On full scan:

1. Disclose the reset in the run record.
2. Search prior immutable runs by globally unique `invocation_id`.
3. Apply `resolution` when a new finish completes a prior incomplete row;
   otherwise emit a prior identity as `reanalysis` with its latest
   `supersedes_run_id`.
4. Never emit a prior identity again as `initial` or count superseded rows as
   separate samples.
5. Replace the checkpoint entry only after the new run is written.

## Pending linked invocations

After selecting lines after a valid watermark, union those identities with all
valid `pending_linked_invocations` for the project. Deduplicate by
`invocation_id` before classification, so one identity produces one row in the
new run. Re-evaluate every retained identity against the current artifact view,
including a no-new-lines run. A retained identity uses `record_role:
reanalysis` and supersedes its entry's `latest_run_id`, unless a newly observed
finish instead satisfies the method's `resolution` rule.

After the immutable run is created, replace the pending list atomically with
only identities still in one of the four pending states. For an identity that
remains pending, preserve `first_pending_run_id` and set `latest_run_id` to
this run. Remove it when this run has safe accepted linkage and either
evaluable outcome evidence or an immutable `report: none` attempt. Record the
latter once as final excluded evidence before removal. Do not remove an
identity for an unchanged watermark, an unavailable or invalid checker result,
or insufficient evidence from an existing non-`none` report. This checkpoint
replay does not edit source logs, handoffs, reports, or earlier runs.

## Publication

1. Set `latest_run_id` to the run producing the entry. A no-new-observations
   run keeps its watermark, replays any pending linked identities, and records
   the new run ID.
2. Require checkpoint bytes to match the SHA-256 captured in the exclusively
   created analysis lock; compare literal `absent` when none existed.
3. Create the run file exclusively; never overwrite a run ID.
4. Advance checkpoint entries only after the immutable run succeeds.
5. Conditionally remove only the exact owned lock on handled stop paths.

## Late finish

| Prior state | New event | Role | Count |
| --- | --- | --- | --- |
| Incomplete identity | Finish | `resolution` | Resolution only |
| No prior identity | Begin or complete pair | `initial` | New invocation only |
| Prior non-incomplete identity during replay | Any replayed pair | `reanalysis` | Reanalysis only |
| Unexpected conflicting history | Any | Conflict | No performance sample |

For `resolution`, set `supersedes_run_id` to the run containing the incomplete
row. Preserve every earlier run unchanged. When combining runs, count only the
latest row for the invocation ID.
