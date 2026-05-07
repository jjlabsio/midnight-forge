# Midnight Forge

Midnight Forge (`mdf`) is a v1 plugin skeleton for proving that one shared skill bundle can be delivered to both Claude Code and Codex.

## v1 Scope

- Product name: `midnight-forge`
- Plugin namespace: `mdf`
- Shared source of truth: root `skills/` directory
- Supported runtimes: Claude Code and Codex
- Included skill: `mdf-handshake`

## Intentionally Excluded

v1 does not include setup, MCP servers, rules routing, runners, background jobs, model orchestration, state persistence, or harness workflows.

## Claude Code

Invoke the handshake through the Claude command shim:

```text
/mdf:mdf-handshake
```

Local development smoke test:

```bash
cd /Users/jaejinsong/code/projects/plugins
claude --plugin-dir ./midnight-forge
```

Then run:

```text
/mdf:mdf-handshake
```

## Codex

Invoke the shared skill through Codex skills:

```text
$mdf-handshake
```

Local development smoke test:

```bash
codex plugin marketplace add /Users/jaejinsong/code/projects/plugins
```

For local testing, create a temporary Codex marketplace at `/Users/jaejinsong/code/projects/plugins/.agents/plugins/marketplace.json`:

```json
{
  "name": "local-plugins",
  "interface": {
    "displayName": "Local Plugins"
  },
  "plugins": [
    {
      "name": "mdf",
      "source": {
        "source": "local",
        "path": "./midnight-forge"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

Restart Codex, install or enable `mdf` from the `Local Plugins` marketplace, then run:

```text
$mdf-handshake
```

The temporary marketplace file is only for local testing and is not part of the v1 plugin skeleton.

## Release

Releases are PR-based. Do not release directly from `main`.

Every PR must include one release intent line in the PR body, title, or labels:

```text
release: major
release: minor
release: patch
release: none
release: 0.1.0
```

When a PR is merged to `main`, the release workflow reads the merged PR intent. If a release is requested, it syncs the Claude Code and Codex plugin manifest versions, updates `CHANGELOG.md`, commits `chore(release): vX.Y.Z`, creates an annotated tag, and creates a GitHub Release. npm publishing is intentionally not part of this workflow.

## Expected Output

```text
midnight-forge skill loaded
runtime: Codex
cwd: /path/to/current/project
mode: plugin skill only; no setup, MCP, rules, runner, or harness workflow used
```

Claude Code should report `runtime: Claude Code` for the same skill.
