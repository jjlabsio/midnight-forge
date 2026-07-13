# Agent Skills Packaging Notes

Midnight Forge vendors the pinned `agent-skills` workflow bundle into native
`skills/`, `references/`, and `agents/` paths. The port preserves upstream
primitive bytes and keeps MDF-only model guidance in explicit overlay inputs.

## Skill name collision check

The upstream bundle includes `test-driven-development`. Midnight Forge keeps
that original name because the plugin manifest exposes one plugin-local tree.
If future Codex behavior proves the name ambiguous, add a documented prefixed
alias without renaming the vendored primitive.

## Packaging contract

`overlays/mdf/inventory.json` and its shards classify each generated output as
upstream-identical, MDF-native, or a Codex entrypoint adaptation. The sync
renderer generates complete root files from the pinned source and overlay
inputs. `validate-agent-skills-sync.js` checks inventory, hashes, paths,
coverage, release metadata, and generated equality. `validate-agent-skills-port.js`
checks the immutable upstream matrix and source/overlay/generated consistency.

These are packaging checks, not workflow authorities. They do not decide task
readiness, approval, review meaning, recovery, ship success, or external
authority. Historical workflow artifacts remain readable even when an old
producer is removed.
