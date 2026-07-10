---
name: ship
description: "Use when the user invokes ship, mdf ship, or asks for the upstream GO/NO-GO launch gate."
---

# ship

Resolve the installed plugin root, load and follow the exact upstream
`../shipping-and-launch/SKILL.md`, and preserve its GO/NO-GO criteria. For its
parallel fan-out, load the exact upstream persona files from the resolved
plugin root: `agents/code-reviewer.md`, `agents/security-auditor.md`, and
`agents/test-engineer.md`. A generic subagent receives the exact selected
persona prompt; the root validates capability, owns synthesis, and is the only
writer. If capability cannot be verified, use root fallback or report the
upstream-defined degraded status; never claim an unavailable persona ran.

Preserve the upstream ship command's parallel `code-reviewer`,
`security-auditor`, and `test-engineer` fan-out, its merge in root context, and
its GO/NO-GO and rollback decision. Do not replace that command behavior with a
new persona protocol.
