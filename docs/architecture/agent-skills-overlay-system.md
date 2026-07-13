# Agent Skills Overlay System

## Purpose

Midnight Forge preserves the pinned `agent-skills` source while keeping
MDF-specific skill and packaging inputs outside the upstream snapshot. The
repository commits complete generated `skills/`, `references/`, and `agents/`
files so Codex can read ordinary files during execution.

## Source layout

```text
vendor/agent-skills/                 # pinned immutable upstream source
vendor/agent-skills.lock.json        # upstream repository and commit
overlays/mdf/inventory.json          # inventory root and shard list
overlays/mdf/inventory/              # generated output inventory shards
overlays/mdf/release-metadata.json   # release source
overlays/mdf/                        # MDF overlay inputs
scripts/sync-agent-skills.js         # packaging renderer
scripts/validate-agent-skills-*.js  # packaging validators
skills/ references/ agents/          # generated runtime surface
```

Each inventory entry records its output, source or overlay input, hash when
applicable, classification, and packaging rationale. Maintained surfaces are
classified as active, historical, or packaging in the task-0041 inventory.

## Sync and validation

The sync renderer reads inventory shards, cleans generated targets, copies
pinned upstream files or MDF overlay inputs, applies release metadata, and
writes complete generated files. Edit overlay inputs first; do not hand-edit a
generated root file. Dry-run mode compares the result byte-for-byte.

The retained validators check inventory schema and path safety, pinned source
hashes, generated coverage, source/overlay equality, release metadata, and
dry-run sync. They are packaging checks. They do not decide task readiness,
approval, review meaning, lifecycle progress, recovery, or ship success.

## Model-led workflow boundary

Public MDF skills are readable workflow guidance over the upstream primitives.
The model owns semantic routing, task interpretation, exact artifact approval,
review meaning, downstream impact, recovery choice, and external authority.
Canonical `.mdf` cards, append-only index projections, locks, and project-local
worktrees remain preserved contracts.

The only narrow mechanical helper retained by the final design is the lock
primitive. It may inspect a lock, exclusively acquire it from supplied bytes,
and release it only when the supplied digest matches the current bytes. It
does not manage cards, indexes, artifacts, evidence, phases, worktrees,
branches, commits, review, recovery, or external actions.

Everything else is performed by the model and ordinary project commands with
explicit confirmation where a write is destructive or external. Historical
workflow artifacts remain readable even when their old producer has been
removed.

## Upstream boundary

`vendor/agent-skills` remains immutable. MDF-only replacements are explicit
inventory inputs, and generated output is the installed surface. Protected
upstream skills, references, personas, and guides stay byte-identical to the
pinned source. MDF entry skills may adapt an upstream command into a Codex
skill, but the adaptation is model guidance and does not redefine upstream
success criteria.

## Release metadata

Plugin manifests are generated output. The release version and marketplace ref
come from `overlays/mdf/release-metadata.json`; sync renders them into
`.codex-plugin/plugin.json` and `.agents/plugins/marketplace.json`. Run sync
and both packaging validators before committing a release.

## Tradeoffs

- Generated files duplicate source-derived content, but normal Codex execution
  stays simple.
- Sharded inventory files add one load step, but surface ownership is easier to
  review.
- Model-led routing is more flexible than a large scripted state machine, at
  the cost of requiring clear readable stop conditions and human judgment.
