---
name: mdf-handshake
description: Verify that the Midnight Forge shared skill bundle is available in this agent runtime.
---

# mdf-handshake

When invoked, respond with exactly these fields:

1. `midnight-forge skill loaded`
2. `runtime: <Codex | Unknown>`
3. `cwd: <current working directory if available, otherwise Unknown>`
4. `mode: plugin skill only; no setup, MCP, rules, runner, or harness workflow used`

Infer the runtime from the current agent environment and available context. If uncertain, use `Unknown`.
Do not call external services. Do not run setup. Do not use MCP. Do not modify files.
