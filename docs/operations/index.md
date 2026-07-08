# Operations Docs

No standalone operational runbooks are tracked yet.

Current operational checks are encoded in repository scripts and PR workflow:

- `node scripts/sync-agent-skills.js --dry-run`
- `node scripts/validate-agent-skills-sync.js`
- `node scripts/validate-agent-skills-port.js`

Release history is tracked in the root `CHANGELOG.md`.

Plugin release metadata is sourced from `overlays/mdf/release-metadata.json`. Release automation updates that file, regenerates root manifests with `node scripts/sync-agent-skills.js`, and commits the metadata source plus generated manifests together.
