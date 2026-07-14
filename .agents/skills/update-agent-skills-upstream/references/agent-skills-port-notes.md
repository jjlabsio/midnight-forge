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

## Upstream update contract

The repository-local `.agents/skills/update-agent-skills-upstream/SKILL.md`
skill is source-first. It records the previous and target commits, compares the complete upstream
`skills/**`, `references/**`, `commands/**`, `agents/**`, and `hooks/**` trees,
and reports additions, deletions, modifications, and renames. It includes
skill-local scripts in the owning skill surface. Upstream root `scripts/**`
and ordinary `docs/**` remain preserved for provenance but are explicit
Codex-runtime exclusions; imported references to them fail closed.

An upstream-owned artifact is never rewritten as an MDF overlay. Inventory
entries retain source hashes, deleted/renamed files receive an explicit
disposition, and generated files are recreated by the sync renderer. The
update report includes generated impact, explicit exclusions, port gaps, and
all validator results.

## Hook port contract

All upstream `hooks/**` files remain in the vendor snapshot. Claude-specific
hooks are not activated in Codex. A separate Codex port note records source and
target paths, lifecycle event, payload, output/exit/timeout behavior, trust
boundary, conversion reason, status, and focused verification. Passing
Claude-only environment variables through unchanged, trusting unvalidated
paths, or suppressing failures without a contract is a blocking port gap.
