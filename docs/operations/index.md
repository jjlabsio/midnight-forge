# Operations Docs

Current operational checks are encoded in repository scripts and PR workflow:

- `node scripts/sync-agent-skills.js --dry-run`
- `node scripts/validate-agent-skills-sync.js`
- `node scripts/validate-agent-skills-port.js`

Model-routing strategy is maintained manually in
[Model Routing Analysis](model-routing-analysis.md). Automated, factual run
records remain in the Midnight Forge repository's gitignored `.mdf` state;
the project-local `.agents/skills/model-routing-analysis/SKILL.md` skill does
not update tracked documents.

Release history is tracked in the root `CHANGELOG.md`.

Plugin release metadata is sourced from `overlays/mdf/release-metadata.json`. Release automation updates that file, regenerates root manifests with `node scripts/sync-agent-skills.js`, and commits the metadata source plus generated manifests together.
