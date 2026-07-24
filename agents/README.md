# MDF Instruction-Source Adapter

The canonical agent-skills persona and orchestration guide is generated without
modification at [docs/agents.md](../docs/agents.md). This file records the
Codex/MDF prompt-dispatch boundary.

- Resolve the instruction source from the installed plugin root, never from a
  fixed cache location or the user project working directory.
- The upstream Markdown files under `agents/` are the canonical persona
  prompts. A persona name is a resolver key, not proof that its instructions
  were loaded.
- Before every delegation, the root loads
  `<plugin-root>/references/subagent-dispatch-policy.md`. The root provides a
  model and reasoning record, then resolves exactly one instruction source
  through the generic runtime path:
  `persona-backed` uses the exact `agents/<persona>.md` prompt, while
  `skill-backed` uses the exact canonical skill adapter without a persona; the
  called adapter loads the primitives required by its public contract.
  Instruction-source and model selection are separate concerns.
- Do not rely on Codex plugin installation to register `.codex/agents/*.toml`.
  Users may configure native custom agents separately in a project or global
  Codex scope, but MDF's portable path is the exact Markdown prompt above.
- If a `persona-backed` call cannot resolve its exact installed persona prompt,
  stop or use a visible degraded root fallback. A `skill-backed` workflow
  operation does not resolve a persona and must not invent one; it stops only
  when its canonical skill instruction source cannot be resolved.
  Missing persona resolution affects only explicitly persona-backed calls.
- The four upstream personas remain byte-identical under this directory.
- A generic subagent receives exactly one resolved instruction source and
  bounded task inputs. Only a root-authorized executor may write its exact
  leased paths. It never invokes another persona or advances lifecycle state.
- Auto-workflow may also use a generic read-only `explorer` dispatch for
  bounded codebase inventory. It has `report-only` authority and no write scope
  and is never treated as an independent design or security decision.
- An automatic executor/critic operation stops when no suitable independent
  critic is available. A visible root fallback is allowed only for delegation
  that does not require independent criticism; it never claims fresh review.
- MDF-owned persona files remain model-agnostic. The root's readable MDF choice
  governs managed delegation.
- The root model owns artifact acceptance, canonical workflow state, approval
  evidence, and root-only synthesis. Persona content remains upstream-owned.
