# Upstream Agent Skills Update Policy

## Source-first rule

`vendor/agent-skills` is the pinned upstream snapshot. `vendor/agent-skills.lock.json`
records the repository, exact commit, source, and recording date. Update the
vendor snapshot and provenance before regenerating any Codex surface. A file
that exists upstream remains upstream-owned; do not rewrite it as an MDF
overlay or preserve an old generated wording by hand.

## Complete comparison surface

Every update compares the complete file list and content under:

- `skills/**`, including skill-local supporting files and scripts;
- `references/**`;
- `commands/**`;
- `agents/**`; and
- `hooks/**`, including manifests, scripts, tests, and hook documentation.

Classify each path as added, deleted, modified, or renamed using content hashes
and deterministic rename pairing. A file is not excluded because the current
inventory does not reference it. New upstream files must appear in the report
and receive an explicit generated, preserved-vendor, port, or exclusion
disposition.

## Runtime import boundary

Upstream root `scripts/**` and ordinary `docs/**` are kept in the vendor
snapshot but are not Codex runtime imports. `skills/**/scripts/**` is different:
it is a skill-local execution resource and follows its owning skill. If an
imported artifact references an excluded root script or document, fail closed
with a port gap or obtain an explicit user decision. Never omit the reference
silently.

Commands are compared even when they are not generated as runtime files.
Agents, references, skills, and skill-local resources are generated only
through inventory entries. The inventory must distinguish `upstream-identical`,
`mdf-rename-or-adapter`, and `mdf-only` classifications and must retain source
hashes for upstream-derived entries.

## Hooks and Codex ports

Preserve the complete upstream `hooks/**` tree in the vendor snapshot. Do not
activate Claude-specific hooks in Codex. A Codex port is a separate surface,
never a modified upstream skill, and records source path, target path, lifecycle
event, payload schema, output and exit behavior, trust assumptions, conversion
reason, status, and verification.

Reject a port when it relies on Claude-only environment variables, accepts an
untrusted path or repository value as authority, emits an unvalidated write,
or suppresses a failure without a documented contract. An unresolved hook
port is a blocking gap, not a successful no-op.

## Generated surface and provenance

Regenerate with `scripts/sync-agent-skills.js`. Recompute `baseSha256` for every
upstream-derived inventory entry. Add new files and remove deleted files from
the generated inventory; record rename evidence in the report instead of
silently converting a rename into an unrelated add/delete pair. Preserve
MDF-only inputs and upstream-identical bytes as separate ownership classes.

Run both maintained packaging validators plus the upstream skill and command
validators. A stale hash, missing inventory entry, generated mismatch, missing
new file, unsafe path, unresolved imported exclusion, or class conflict fails
the update.

## Required update report

Store a full report in the active MDF work artifact when available. It must
state the previous and target commits, repository and lock verification;
added/deleted/modified/renamed files by category; skill-local script changes;
root-script/document exclusions; hook port decisions and gaps; generated and
inventory impact; source hashes; MDF-only boundary checks; and every validation
result. Present the user with a concise summary and identify any manual review
that remains.
