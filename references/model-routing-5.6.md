# GPT-5.6 Model Routing Reference

This is a readable routing guide for MDF-managed subagents. It is not a
runtime selector or script-enforced model contract.

Quality-critical lifecycle work uses the GPT-5.6 family. The root AI selects
the appropriate currently available profile and reasoning setting from that
family based on task difficulty, risk, ambiguity, novelty, consequence, and
the required quality. Do not silently use an older or unreviewed future family.

For narrow, read-only codebase exploration, prefer the exact model
`gpt-5.3-codex-spark` when the current runtime can use it. Spark is report-only,
has no write scope, and cannot decide design, security, implementation,
lifecycle, ship, or external-action questions.

If Spark is unavailable or its transport is incompatible, the root AI may use
a suitable GPT-5.6 read-only explorer. If that is also unavailable, the root
performs the exploration itself and records the degraded fallback in its
readable work-item notes.

Persona model settings are defaults for ordinary direct invocation. For
MDF-managed delegation, the root AI chooses the model and preserves the
persona's perspective without allowing the persona to expand its authority.

The selected model, the reason for selection, capability uncertainty, any
fallback, and the worker's read/write authority belong in the root's readable
dispatch note. Model selection remains AI judgment; it is not a fixed task
table, benchmark calculator, or lifecycle controller.
