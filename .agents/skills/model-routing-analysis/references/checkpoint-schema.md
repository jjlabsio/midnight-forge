# Model Routing Analysis Checkpoint Contract

The checkpoint is a small, stable JSON document at:

```text
.mdf/analysis/model-routing/checkpoint.json
```

Use `schema_version: 3` and `method_version: 3`. `status` is exactly
`included` or `excluded`. The top-level shape is:

```json
{
  "schema_version": 3,
  "method_version": 3,
  "projects": [
    {
      "registry_id": "<stable ~/.mdf/projects.json id>",
      "canonical_root_sha256": "<64 lowercase hex characters>",
      "status": "included",
      "consumed_line_count": 0,
      "consumed_prefix_sha256": "<sha256 of the exact consumed prefix>",
      "latest_run_id": "<analysis-run-id>",
      "reason": null
    }
  ]
}
```

Keep `projects` sorted by `registry_id`. Do not write an absolute canonical
path. Compute `canonical_root_sha256` as SHA-256 of the normalized absolute
`canonical_root` string from the current registry entry.

`consumed_line_count` counts physical JSONL lines, including malformed lines.
`consumed_prefix_sha256` is SHA-256 of the exact UTF-8 bytes of those lines,
including their line endings. An empty prefix uses SHA-256 of the empty byte
string. A source log whose final line is not newline-terminated is invalid for
incremental reuse; disclose the condition and rescan it from the beginning.

For an included project with no observation log, use zero and the empty-prefix
hash, with `reason: "no_observation_log"`. For an invalid or inaccessible
registered project, use `status: "excluded"`, zero and the empty-prefix hash,
and record a concise reason. Never silently drop a registered project.

Reuse a saved checkpoint only when its top-level `schema_version` and
`method_version` match the current contract. Then reuse a saved project
watermark only when its `registry_id`,
`canonical_root_sha256`, line count, and exact consumed-prefix hash all match
the current registry and source log. On any version or identity mismatch, do
not migrate the checkpoint in place: perform a full rescan, disclose the reset
in the run record, and replace that project's checkpoint entry only after the
new run record is written.

Set `latest_run_id` to the run that produced the current entry. Advance every
entry only after the immutable run record has been written successfully. A
no-new-observations run keeps the same watermark and records the new run ID.

## Late terminal resolution

Run records are immutable, so a dispatch with no terminal may first be written
as an incomplete observation and later receive a terminal event. In that later
run:

- search prior immutable run records for the exact `invocation_id`;
- mark the new row `record_role: resolution` and set `supersedes_run_id` to
  the prior run ID that recorded the incomplete state;
- preserve the original incomplete row for audit history; and
- when combining run records, count only the latest resolution for that
  `invocation_id`, not the incomplete row and resolution as two invocations.

If no prior incomplete row exists, use `record_role: initial` and disclose any
unexpected source-log history as a conflict. A resolution never changes an
earlier run record.
