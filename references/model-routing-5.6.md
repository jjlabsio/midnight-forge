# GPT-5.6 Model Routing Reference

This is a readable routing guide for MDF-managed subagents. It is not a
runtime selector or script-enforced model contract.

Before selecting a GPT-5.6 candidate, consult
`model-routing-performance.md`. That document records the reviewed
intelligence-versus-cost comparison as a qualitative prior. It does not define
an MDF capability contract or guarantee semantic quality.

Use the GPT-5.6 family by default for quality-critical lifecycle work. Select
the currently available profile and its native reasoning configuration based
on task difficulty, risk, ambiguity, novelty, consequence, required quality,
runtime capability, and transport compatibility. Do not silently use an older
or unreviewed future model family.

The only model exception is narrow, read-only codebase exploration with
report-only output and no write, design, implementation, testing, review,
security, lifecycle, or external-action authority. When compatible Spark
transport is available, use the exact model `gpt-5.3-codex-spark` and its
highest supported reasoning setting for that exception.

If Spark is unavailable or incompatible, use a suitable GPT-5.6 read-only
fallback. If no suitable fallback is available, the root performs the
exploration and records the degraded result.

MDF does not define, enumerate, or normalize the runtime's reasoning-setting
vocabulary. The `fast` option and speed-only profiles are prohibited for every
model. Runtime-native model configuration remains authoritative.

Persona model settings are defaults for ordinary direct invocation. For
MDF-managed delegation, the root AI chooses the model and preserves the
persona's perspective without allowing the persona to expand its authority.

The selected model, the reason for selection, the performance-reference
context, capability uncertainty, any fallback, and the worker's read/write
authority belong in the root's readable dispatch note. Model selection remains
AI judgment; it is not a fixed task table, benchmark calculator, or lifecycle
controller.
