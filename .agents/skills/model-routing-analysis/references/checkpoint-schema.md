# Model Routing Analysis Checkpoint Contract

Path:

```text
.mdf/analysis/model-routing/checkpoint.json
```

Use `schema_version: 4`, `method_version: 5`, and status `included` or
`excluded`.

## Shape

```json
{
  "schema_version": 4,
  "method_version": 5,
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

## Project entry

- Sort `projects` by `registry_id`.
- Hash the normalized absolute registry `canonical_root` string into
  `canonical_root_sha256`; never store the path.
- Count physical JSONL lines, including malformed lines.
- Hash exact consumed UTF-8 bytes, including line endings.
- Use the SHA-256 of empty bytes for an empty prefix.
- Treat a non-newline-terminated final log line as invalid for incremental
  reuse; disclose and full-scan.

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
3. Apply `resolution` when a new terminal completes a prior incomplete row;
   otherwise emit a prior identity as `reanalysis` with its latest
   `supersedes_run_id`.
4. Never emit a prior identity again as `initial` or count superseded rows as
   separate samples.
5. Replace the checkpoint entry only after the new run is written.

## Publication

1. Set `latest_run_id` to the run producing the entry. A no-new-observations
   run keeps its watermark and records the new run ID.
2. Require checkpoint bytes to match the SHA-256 captured in the exclusively
   created analysis lock; compare literal `absent` when none existed.
3. Create the run file exclusively; never overwrite a run ID.
4. Advance checkpoint entries only after the immutable run succeeds.
5. Conditionally remove only the exact owned lock on handled stop paths.

## Late terminal

| Prior state | New event | Role | Count |
| --- | --- | --- | --- |
| Incomplete identity | Terminal | `resolution` | Resolution only |
| No prior identity | Dispatch or complete pair | `initial` | New invocation only |
| Prior non-incomplete identity during replay | Any replayed pair | `reanalysis` | Reanalysis only |
| Unexpected conflicting history | Any | Conflict | No performance sample |

For `resolution`, set `supersedes_run_id` to the run containing the incomplete
row. Preserve every earlier run unchanged. When combining runs, count only the
latest row for the invocation ID.
