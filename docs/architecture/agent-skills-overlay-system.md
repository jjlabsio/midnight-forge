# Agent Skills Overlay System

## Purpose

Midnight Forge preserves upstream `agent-skills` source while keeping MDF-specific behavior outside that upstream snapshot. The repository commits complete generated runtime files so Codex and future agents can read ordinary `skills/`, `references/`, and `agents/` files during execution.

## Source Layout

```text
vendor/agent-skills/                 # pinned immutable upstream source
vendor/agent-skills.lock.json        # upstream repository and commit
overlays/mdf/inventory.json          # root overlay manifest and shard file list
overlays/mdf/inventory/              # generated output inventory shards
overlays/mdf/release-metadata.json   # plugin version and marketplace release ref source
overlays/mdf/                        # MDF overlay inputs
scripts/sync-agent-skills.js         # renderer
scripts/validate-agent-skills-sync.js
scripts/validate-agent-skills-port.js
skills/ references/ agents/          # generated runtime surface
```

## Overlay Kinds

`overlays/mdf/inventory.json` stores global overlay metadata:

- `schemaVersion`
- pinned upstream repository and commit
- generated clean targets
- excluded upstream files
- ordered `generated.entryFiles` shard references
- overlay v2 policy metadata

Each file under `overlays/mdf/inventory/` records generated output entries for one reviewable surface. Skill entries live in `overlays/mdf/inventory/skills/{skill}.json` so a reviewer can inspect a specific skill's upstream relationship without scanning one large manifest. Non-skill generated outputs use namespace shards such as `agents/`, `references/`, `commands/`, and `packaging/` instead of being forced into a skill-only model.

Each generated output entry records one overlay kind. Protected upstream
primitives, personas, guides, and security references use only `copy`:

- `copy`: copy a pinned upstream file.
- `mdfOnly`: copy an MDF-native file with no upstream source.
- `mdfOnly`: render a controller, task, packaging, or adapter file that has no
  upstream counterpart.
- `renameAdapter`: expose an MDF public controller for a command name.

Semantic fragment, patch, and source-backed replacement entries are not valid
in the current generated-surface contract. The port validator owns the explicit
immutable equality matrix and rejects preserved upstream drift.

## Sync Flow

1. Read `overlays/mdf/inventory.json`.
2. Load each `generated.entryFiles` shard and combine the entries in manifest order.
3. Clean generated output targets.
4. For each entry, read the pinned upstream source or MDF overlay source.
5. Verify base hashes when present.
6. Render the declared copy or MDF-owned controller.
7. Write complete generated files to root `skills/`, `references/`, `agents/`, manifests, and README.

Dry-run mode renders to a temporary directory and byte-compares the result against checked-in generated output.

## Validation Flow

`scripts/validate-agent-skills-sync.js` checks inventory schema, shard path
safety, duplicate shard references, duplicate outputs, unsafe paths, generated
coverage, and generated path references. `scripts/validate-agent-skills-port.js`
enforces byte equality for the protected matrix, deletes evaluator surfaces,
and exercises controller contracts for approvals, build modes, review freshness,
DDD parity, persona loading, and one-writer orchestration.

## Controller Policy

MDF never injects artifact storage or lifecycle behavior into upstream
primitives. MDF controllers apply canonical artifact storage under:

```text
<canonical-root>/.mdf/work/{work_id}/{artifact-type}-NNN.md
```

Controllers record spec and plan approval against the exact canonical artifact
revision/hash and invalidate it on revision. They resolve skill, persona,
reference, documentation, and supporting-script paths from the installed plugin
root, not the user project's working directory or a fixed cache path.

## Release Metadata

Plugin manifests are generated output. The release version and marketplace ref come from `overlays/mdf/release-metadata.json`; sync renders those values into `.codex-plugin/plugin.json` and `.agents/plugins/marketplace.json`.

The release workflow updates `overlays/mdf/release-metadata.json`, runs `node scripts/sync-agent-skills.js`, and then runs the generated-surface validators before committing the release. Do not update root generated manifests as the independent source of truth.

## Tradeoffs

- Generated runtime files duplicate source-derived content, but normal Codex execution stays simple.
- Sharded inventory files add one extra load step, but skill-specific changes are easier to review and non-skill generated surfaces keep their own namespaces.
- Upstream content is easy to update and audit because protected outputs remain
  byte-identical to the pinned source.
- MDF controllers are intentionally small: they adapt runtime and lifecycle
  state without redefining upstream workflow success criteria.

## Related Decisions

- [Use generated runtime files](../decisions/agent-skills-overlay/generated-runtime-files.md)
- [Replace artifact storage rules](../decisions/agent-skills-overlay/overlay-v2-artifact-storage.md)
- [Use a Codex-only plugin surface](../decisions/agent-skills-overlay/codex-only-plugin-surface.md)
