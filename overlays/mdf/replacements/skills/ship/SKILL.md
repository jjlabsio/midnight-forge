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

From the resolved plugin root, call production
`./scripts/mdf-controller.js ship context`. It binds the current passing
standalone review, active plan, clean Git tree, and runtime-computed diff size,
and returns whether the exact upstream small-change exception applies. Unless
that exception applies, run all returned personas in parallel through the
adapter with the context sidecar as their exact input and preserve every raw
report unchanged.

Root then performs the upstream merge and rollback synthesis against the exact
context and report decisions. Call `ship register` with those raw paths and
the provenance-bound root synthesis. A rollback trigger, procedure, and RTO
are mandatory. Missing/stale reports, an unsupported persona claim, or NO-GO
blocks the PR transition.

When GO would accept a blocking risk, stop for the user. Only after an explicit
affirmative action call `ship risk` with exact `risk_ids` and the raw user
message, then include that acceptance in a newly bound synthesis. Never infer
risk acceptance from report prose or reuse it on another tree.
