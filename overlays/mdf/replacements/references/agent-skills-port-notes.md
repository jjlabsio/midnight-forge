# Agent Skills Port Notes

Midnight Forge vendors the original `agent-skills` workflow bundle from `/Users/jaejinsong/code/projects/plugins/agent-skills` into the plugin's native `skills/`, `references/`, and `agents/` paths.

## Skill Name Collision Check

The original `agent-skills` bundle includes `test-driven-development`. This name can collide conceptually with other installed plugins that expose a `test-driven-development` skill, including Superpowers.

For this port, Midnight Forge preserves the original skill name instead of prefixing it because task 001 requires original names unless a concrete Codex name-collision problem forces a documented adjustment. No manifest-level conflict exists inside Midnight Forge because `.codex-plugin/plugin.json` exposes only this plugin's `./skills/` tree, and Codex presents plugin-contributed skills with plugin context.

If future Codex behavior proves that unprefixed skill names are ambiguous at invocation time, the compatible fallback is to add prefixed aliases that delegate to the preserved original skills instead of renaming the vendored originals.
