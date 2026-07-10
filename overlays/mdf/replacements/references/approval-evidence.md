# MDF Approval Evidence Contract

Store every spec or plan approval as canonical
`.mdf/work/{work_id}/approval-NNN.md` evidence and update `item.md`
`latest.approval` plus `.mdf/index.jsonl`.

```yaml
kind: spec | plan
artifact: spec-NNN.md | plan-NNN.md
artifact_sha256: <SHA-256 of exact artifact bytes>
latest_pointer: <the matching item.md latest value at approval time>
affirmative: true
affirmative_user_message: <verbatim affirmative user action>
approved_at: <ISO-8601 timestamp>
```

The controller may transition only when all of `kind`, `artifact`,
`artifact_sha256`, and `latest_pointer` match the current canonical artifact and
the record has `affirmative: true`. Any new artifact revision or latest-pointer
change invalidates the record. Artifact existence, a reviewer pass, or an
auto-workflow invocation is not approval.
