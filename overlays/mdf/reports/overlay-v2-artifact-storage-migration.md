# Overlay v2 Artifact Storage Migration

This report documents the first overlay v2 migration. The migrated entries render from the pinned upstream `agent-skills` source plus the shared MDF artifact storage policy in `overlays/mdf/references/artifact-storage-override.md`.

## Migrated Targets

- `skills/api-and-interface-design/SKILL.md`
- `skills/ci-cd-and-automation/SKILL.md`
- `skills/debugging-and-error-recovery/SKILL.md`
- `skills/deprecation-and-migration/SKILL.md`
- `skills/frontend-ui-engineering/SKILL.md`
- `skills/idea-refine/SKILL.md`
- `skills/interview-me/SKILL.md`
- `skills/performance-optimization/SKILL.md`
- `skills/security-and-hardening/SKILL.md`
- `skills/test-driven-development/SKILL.md`

## Intentional Normalization

These targets no longer use full-file replacements. Their generated files now start from upstream and add only MDF artifact storage instructions through exact anchors and exact patches recorded in `overlays/mdf/inventory.json`.

Previous replacement files also contained a few non-storage differences in `debugging-and-error-recovery`, `interview-me`, and `security-and-hardening`. Those differences are intentionally normalized back to upstream so the first v2 migration proves the narrow policy-injection path rather than preserving unrelated drift in an artifact-storage overlay.

## Validation Expectations

- Every migrated target records `baseSha256` for the pinned upstream source.
- Every policy injection records a unique heading anchor and `anchorSha256`.
- Exact patches must match the pinned upstream source exactly once.
- `node scripts/sync-agent-skills.js --dry-run` must render to a temporary directory and byte-compare against checked-in generated files.
- `node scripts/validate-agent-skills-sync.js` must fail if a migrated target falls back to a full replacement.
