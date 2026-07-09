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

Each generated output entry records one overlay kind:

- `copy`: copy a pinned upstream file.
- `mdfOnly`: copy an MDF-native file with no upstream source.
- `fragment`: render from upstream and inject a narrow MDF policy fragment.
- `patch`: render from upstream and apply exact patches.
- `replacement`: use a full MDF replacement with rationale, risk, and upstream base hash.
- `renameAdapter`: adapt an upstream skill to an MDF name or route.

## Sync Flow

1. Read `overlays/mdf/inventory.json`.
2. Load each `generated.entryFiles` shard and combine the entries in manifest order.
3. Clean generated output targets.
4. For each entry, read the pinned upstream source or MDF overlay source.
5. Verify base hashes when present.
6. Apply exact patches and policy injections when declared.
7. Write complete generated files to root `skills/`, `references/`, `agents/`, manifests, and README.

Dry-run mode renders to a temporary directory and byte-compares the result against checked-in generated output.

## Validation Flow

`scripts/validate-agent-skills-sync.js` checks inventory schema, shard path safety, duplicate shard references, duplicate outputs, unsafe paths, stale hashes, replacement metadata, fragment anchors, exact patch matches, generated file coverage, and generated path references.

`scripts/validate-agent-skills-port.js` checks runtime skill presence and important MDF workflow semantics.

## Artifact Storage Policy

Artifact-storage-only skills render from upstream plus the MDF artifact storage policy. Upstream persistence instructions for tracked files are replaced with MDF storage under:

```text
<canonical-root>/.mdf/work/{work_id}/{artifact-type}-NNN.md
```

Generated artifact-storage-only skills must not retain upstream tracked storage paths such as `docs/`, `SPEC.md`, `tasks/plan.md`, or `tasks/todo.md`.

## Release Metadata

Plugin manifests are generated output. The release version and marketplace ref come from `overlays/mdf/release-metadata.json`; sync renders those values into `.codex-plugin/plugin.json` and `.agents/plugins/marketplace.json`.

The release workflow updates `overlays/mdf/release-metadata.json`, runs `node scripts/sync-agent-skills.js`, and then runs the generated-surface validators before committing the release. Do not update root generated manifests as the independent source of truth.

## Tradeoffs

- Generated runtime files duplicate source-derived content, but normal Codex execution stays simple.
- Sharded inventory files add one extra load step, but skill-specific changes are easier to review and non-skill generated surfaces keep their own namespaces.
- Full replacements are still allowed for complex MDF behavior, but they must be explicitly risky and hash-pinned.
- Fragment overlays are safer for narrow policies, but require stable anchors and validation.

## Related Decisions

- [Use generated runtime files](../decisions/agent-skills-overlay/generated-runtime-files.md)
- [Replace artifact storage rules](../decisions/agent-skills-overlay/overlay-v2-artifact-storage.md)
- [Use a Codex-only plugin surface](../decisions/agent-skills-overlay/codex-only-plugin-surface.md)
