# Midnight Forge v1 Plugin Structure Brief

## Purpose

Midnight Forge (`mdf`) v1 exists to prove one thing only:

> A single shared skill bundle can be delivered as a plugin to both Claude Code and Codex.

Do not build the harness workflow in v1. Do not add a runner, setup wizard, MCP server, rules router, background jobs, or model orchestration. The v1 deliverable is the smallest plugin skeleton that lets both runtimes load and execute the same test skill.

## Decisions Already Made

- Product name: `midnight-forge`
- Short namespace/acronym: `mdf`
- v1 test skill name: `mdf-handshake`
- v1 skill count: exactly one skill
- v1 setup skill: excluded
- v1 MCP server: excluded
- v1 rules routing: excluded
- v1 runner: excluded
- Supported runtimes: Claude Code and Codex only
- Shared source of truth: root `skills/` directory

## Why This Structure

Two local reference projects were reviewed:

1. `ouroboros`
   - Uses root `skills/*/SKILL.md` as the canonical skill source.
   - Claude Code plugin can expose `skills` and `mcpServers` from plugin metadata.
   - Claude commands can be thin shims that read a corresponding `SKILL.md`.
   - Codex can consume the same skill bundles, but Ouroboros also has rules and MCP because it implements real workflow routing and long-running jobs.

2. `superpowers`
   - Provides stable cross-runtime skills.
   - Codex plugin uses `.codex-plugin/plugin.json` with `"skills": "./skills/"`.
   - It is skills-first on Codex and does not require command shims there.
   - This confirms that a shared root `skills/` directory is the correct v1 design for `mdf`.

The v1 `midnight-forge` design follows the `superpowers` skills-first approach and uses only a minimal Claude command shim for explicit Claude Code invocation.

## Target File Tree

Create this structure:

```text
midnight-forge/
  .claude-plugin/
    plugin.json
  .codex-plugin/
    plugin.json
  commands/
    mdf-handshake.md
  skills/
    mdf-handshake/
      SKILL.md
  README.md
```

Do not create these in v1:

```text
.mcp.json
rules/
src/
scripts/
hooks/
agents/
commands/setup.md
skills/setup/
```

## Claude Code Plugin

Claude Code should receive the plugin as a normal Claude plugin.

Recommended `.claude-plugin/plugin.json` shape:

```json
{
  "name": "mdf",
  "version": "0.1.0",
  "description": "Midnight Forge v1 shared skill plugin skeleton for Claude Code and Codex.",
  "author": {
    "name": "Jaejin Song"
  },
  "homepage": "https://github.com/jaejinsong/midnight-forge",
  "repository": "https://github.com/jaejinsong/midnight-forge",
  "license": "MIT",
  "keywords": [
    "skills",
    "plugin",
    "claude-code",
    "codex",
    "harness"
  ],
  "skills": "./skills/"
}
```

Notes:

- Use plugin name `mdf` so Claude command namespace can be short.
- Do not include `mcpServers`.
- Do not include setup-specific metadata.
- If marketplace metadata is added later, keep it separate from this v1 brief.

## Claude Command Shim

Claude Code supports explicit plugin commands. Add one command shim:

`commands/mdf-handshake.md`

Recommended content:

```md
---
description: "Verify that Midnight Forge shared skills are available"
---

Read the file at `${CLAUDE_PLUGIN_ROOT}/skills/mdf-handshake/SKILL.md` using the Read tool and follow its instructions exactly.
```

Expected Claude Code invocation:

```text
/mdf:mdf-handshake
```

This command exists only for Claude Code. Codex should not rely on `commands/`.

## Codex Plugin

Codex should receive the plugin as a normal Codex plugin with a skills-first manifest.

Recommended `.codex-plugin/plugin.json` shape:

```json
{
  "name": "mdf",
  "version": "0.1.0",
  "description": "Midnight Forge v1 shared skill plugin skeleton for Claude Code and Codex.",
  "author": {
    "name": "Jaejin Song"
  },
  "homepage": "https://github.com/jaejinsong/midnight-forge",
  "repository": "https://github.com/jaejinsong/midnight-forge",
  "license": "MIT",
  "keywords": [
    "skills",
    "plugin",
    "codex",
    "claude-code",
    "harness"
  ],
  "skills": "./skills/",
  "interface": {
    "displayName": "Midnight Forge",
    "shortDescription": "Shared mdf skill plugin skeleton for Codex and Claude Code.",
    "longDescription": "Midnight Forge v1 verifies that one shared SKILL.md bundle can be used from both Codex and Claude Code without setup, MCP, rules, or a runner.",
    "developerName": "Jaejin Song",
    "category": "Coding",
    "capabilities": [
      "Interactive",
      "Read"
    ],
    "defaultPrompt": [
      "Run the mdf-handshake skill."
    ]
  }
}
```

Notes:

- Use `"skills": "./skills/"`.
- Do not include `mcpServers`.
- Do not include rules routing.
- Codex invocation should be skill-based, for example `$mdf-handshake` or the Codex skills UI.

## Shared Skill

The single v1 skill is:

```text
skills/mdf-handshake/SKILL.md
```

Recommended content:

```md
---
name: mdf-handshake
description: Verify that the Midnight Forge shared skill bundle is available in this agent runtime.
---

# mdf-handshake

When invoked, respond with exactly these fields:

1. `midnight-forge skill loaded`
2. `runtime: <Claude Code | Codex | Unknown>`
3. `cwd: <current working directory if available, otherwise Unknown>`
4. `mode: plugin skill only; no setup, MCP, rules, runner, or harness workflow used`

Infer the runtime from the current agent environment and available context. If uncertain, use `Unknown`.
Do not call external services. Do not run setup. Do not use MCP. Do not modify files.
```

The purpose of this skill is not functionality. It is a smoke test for shared plugin skill loading.

## README Scope

Add a short `README.md` with:

- What `midnight-forge` is
- v1 scope
- What is intentionally excluded
- Claude Code invocation example
- Codex invocation example
- Expected handshake output

Keep it factual. Do not describe unimplemented harness workflows as available.

## Expected Runtime UX

Claude Code:

```text
/mdf:mdf-handshake
```

Codex:

```text
$mdf-handshake
```

Expected output:

```text
midnight-forge skill loaded
runtime: Claude Code
cwd: /path/to/current/project
mode: plugin skill only; no setup, MCP, rules, runner, or harness workflow used
```

or:

```text
midnight-forge skill loaded
runtime: Codex
cwd: /path/to/current/project
mode: plugin skill only; no setup, MCP, rules, runner, or harness workflow used
```

## Acceptance Criteria

v1 is complete only when all are true:

- `.claude-plugin/plugin.json` exists.
- `.codex-plugin/plugin.json` exists.
- Both manifests point at the same root `skills/` directory.
- `skills/mdf-handshake/SKILL.md` exists and is the only skill.
- `commands/mdf-handshake.md` exists for Claude Code.
- No `setup` skill exists.
- No `.mcp.json` exists.
- No rules directory exists.
- No runner/workflow implementation exists.
- Claude Code can invoke the handshake skill through `/mdf:mdf-handshake`.
- Codex can invoke the handshake skill through its skills mechanism.
- Both runtimes produce the `midnight-forge skill loaded` line.

## Non-Goals

Do not implement any of these in v1:

- `mdf setup`
- `mdf run`
- requirement interview
- seed generation
- background execution
- job status polling
- cancellation
- Claude/Codex subprocess runner
- MCP tools
- rules-based command routing
- state persistence
- marketplace publishing automation

## Future Direction

After v1 proves plugin compatibility, possible next steps are:

- Add a real `mdf` entry skill.
- Add a setup or doctor skill only if environment validation becomes necessary.
- Add MCP only when a shared long-running job API is needed.
- Add runner support only after the harness workflow is specified.
- Keep `skills/` as the canonical source across Claude Code and Codex.

