# Agent Skills Overlay System

## Purpose

Midnight Forge preserves upstream `agent-skills` source while keeping MDF-specific behavior outside that upstream snapshot. The repository commits complete generated runtime files so Codex and future agents can read ordinary `skills/`, `references/`, and `agents/` files during execution.

## Source Layout

```text
vendor/agent-skills/                 # pinned immutable upstream source
vendor/agent-skills.lock.json        # upstream repository and commit
overlays/mdf/inventory.json          # generated output inventory and overlay metadata
overlays/mdf/                        # MDF overlay inputs
scripts/sync-agent-skills.js         # renderer
scripts/validate-agent-skills-sync.js
scripts/validate-agent-skills-port.js
skills/ references/ agents/          # generated runtime surface
```

## Overlay Kinds

`overlays/mdf/inventory.json` records each generated output and one overlay kind:

- `copy`: copy a pinned upstream file.
- `mdfOnly`: copy an MDF-native file with no upstream source.
- `fragment`: render from upstream and inject a narrow MDF policy fragment.
- `patch`: render from upstream and apply exact patches.
- `replacement`: use a full MDF replacement with rationale, risk, and upstream base hash.
- `renameAdapter`: adapt an upstream skill to an MDF name or route.

## Sync Flow

1. Read `overlays/mdf/inventory.json`.
2. Clean generated output targets.
3. For each entry, read the pinned upstream source or MDF overlay source.
4. Verify base hashes when present.
5. Apply exact patches and policy injections when declared.
6. Write complete generated files to root `skills/`, `references/`, `agents/`, manifests, and README.

Dry-run mode renders to a temporary directory and byte-compares the result against checked-in generated output.

## Validation Flow

`scripts/validate-agent-skills-sync.js` checks inventory schema, duplicate outputs, unsafe paths, stale hashes, replacement metadata, fragment anchors, exact patch matches, generated file coverage, and generated path references.

`scripts/validate-agent-skills-port.js` checks runtime skill presence and important MDF workflow semantics.

## Artifact Storage Policy

Artifact-storage-only skills render from upstream plus the MDF artifact storage policy. Upstream persistence instructions for tracked files are replaced with MDF storage under:

```text
<canonical-root>/.mdf/work/{work_id}/{artifact-type}-NNN.md
```

Generated artifact-storage-only skills must not retain upstream tracked storage paths such as `docs/`, `SPEC.md`, `tasks/plan.md`, or `tasks/todo.md`.

## Release Metadata

Plugin manifests are generated output. Their overlay source files must match checked-in generated files so sync does not revert release metadata.

## Tradeoffs

- Generated runtime files duplicate source-derived content, but normal Codex execution stays simple.
- Full replacements are still allowed for complex MDF behavior, but they must be explicitly risky and hash-pinned.
- Fragment overlays are safer for narrow policies, but require stable anchors and validation.

## Related Decisions

- [Use generated runtime files](../decisions/agent-skills-overlay/generated-runtime-files.md)
- [Replace artifact storage rules](../decisions/agent-skills-overlay/overlay-v2-artifact-storage.md)
- [Use a Codex-only plugin surface](../decisions/agent-skills-overlay/codex-only-plugin-surface.md)
