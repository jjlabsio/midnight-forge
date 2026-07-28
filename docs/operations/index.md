# Operations Docs

Current operational checks are encoded in repository scripts and PR workflow:

- `node scripts/sync-agent-skills.js --dry-run`
- `node scripts/validate-agent-skills-sync.js`
- `node scripts/validate-agent-skills-port.js`

The active [Model Routing Policy](model-routing.md) is maintained manually.
[Model Routing Analysis](model-routing-analysis.md) and
[historical routing evidence](../research/model-routing-evidence.md) inform
later policy changes but do not select a model. Automated, factual run records
remain in the Midnight Forge repository's gitignored `.mdf` state; the
project-local `.agents/skills/model-routing-analysis/SKILL.md` skill does not
update tracked documents.

Release history is tracked in the root `CHANGELOG.md`.

Plugin release metadata is sourced from `overlays/mdf/release-metadata.json`. Release automation updates that file, regenerates root manifests with `node scripts/sync-agent-skills.js`, and commits the metadata source plus generated manifests together.
