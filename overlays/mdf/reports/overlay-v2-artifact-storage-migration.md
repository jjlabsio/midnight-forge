# Overlay v2 Artifact Storage Migration

Historical report. Task 0032 supersedes this migration: protected upstream
surfaces now render as byte-identical copies and MDF controllers, not primitive
overlays, own artifact storage and runtime adaptation.

## Former Migrated Targets

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

## Supersession

The listed targets are now direct upstream copies. The historical fragment and
patch model is no longer an allowed generated-surface contract.

## Validation Expectations

- Every protected target is byte-identical to its pinned upstream source.
- Generated-surface validation rejects arbitrary patches, full replacements,
  and preserved-drift metadata for the protected matrix.
- `node scripts/sync-agent-skills.js --dry-run` must render to a temporary directory and byte-compare against checked-in generated files.
- The current validator rejects semantic patches and source-backed replacements
  before generated output is accepted.
