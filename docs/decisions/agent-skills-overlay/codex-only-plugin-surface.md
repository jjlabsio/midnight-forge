# Use a Codex-Only Plugin Surface

## Status

Accepted

## Date

2026-07-04

## Context

Early Midnight Forge experiments considered a shared Claude Code and Codex plugin skeleton. Current product direction is Codex-only. Keeping Claude plugin metadata or command shims would create dead surfaces and invite future agents to preserve obsolete behavior.

## Decision

Midnight Forge exposes a Codex plugin surface only. Do not recreate `.claude-plugin/` or `commands/` shims unless product direction changes explicitly.

## Alternatives Considered

### Maintain Claude Code compatibility

- Pros: Broader runtime compatibility.
- Cons: Adds generated surfaces and command semantics that the project no longer supports.
- Rejected because current MDF workflows target Codex.

### Keep historical v1 brief as tracked docs

- Pros: Preserves early context.
- Cons: The document recommends obsolete files and runtime assumptions.
- Rejected. Important context is captured here instead.

## Consequences

- `.codex-plugin/plugin.json` remains the plugin manifest.
- Root `skills/` is the runtime skill surface.
- Generated validation rejects resurrected Claude Code command shims.
- Old Superpowers and v1 skeleton documents can be removed after their durable decisions are captured.
