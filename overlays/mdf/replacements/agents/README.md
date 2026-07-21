# MDF Instruction-Source Adapter

The canonical agent-skills persona and orchestration guide is generated without
modification at [docs/agents.md](../docs/agents.md). This file records the
Codex/MDF prompt-dispatch boundary.

- Resolve the instruction source from the installed plugin root, never from a
  fixed cache location or the user project working directory.
- The upstream Markdown files under `agents/` are the canonical persona
  prompts. A persona name is a resolver key, not proof that its instructions
  were loaded.
- Before every delegation, the root loads the plugin-installed
  `../references/subagent-dispatch-policy.md`,
  `../references/model-routing-5.6.md`, and
  `../references/model-routing-performance.md`. GPT-5.6 is the default; only
  narrow, read-only, report-only exploration uses the exact
  `gpt-5.3-codex-spark` model with its highest supported reasoning setting.
  The root selects the MDF model and reasoning record, then resolves exactly
  one instruction source through the generic runtime path:
  `persona-backed` uses the exact `agents/<persona>.md` prompt, while
  `skill-backed` uses the exact canonical skill adapter and applicable
  upstream primitives without a persona. Instruction-source and model
  selection are separate concerns.
- Do not rely on Codex plugin installation to register `.codex/agents/*.toml`.
  Users may configure native custom agents separately in a project or global
  Codex scope, but MDF's portable path is the exact Markdown prompt above.
- If a `persona-backed` call cannot resolve its exact installed persona prompt,
  stop or use a visible degraded root fallback. A `skill-backed` automatic
  stage does not resolve a persona and must not invent one; it stops only when
  its canonical skill instruction source cannot be resolved.
- The four upstream personas remain byte-identical under this directory.
- A generic subagent receives exactly one resolved instruction source and
  bounded task inputs. It reports to the root; it does not write shared
  artifacts, invoke another persona, or advance lifecycle state.
- Auto-workflow may also use a generic read-only `explorer` dispatch for
  bounded codebase inventory. The performance reference informs the root's
  cost/intelligence judgment, but Spark has `report-only` authority and no
  write scope, and is never treated as an independent design or security
  decision. No model may use a `fast` option or speed-only profile.
- The root considers capability, uses a root fallback for quality-critical work
  when a suitable worker cannot be selected, and records any degraded
  freshness status honestly.
- MDF-owned persona files remain model-agnostic. The root's readable MDF choice
  governs managed delegation.
- The root model owns canonical artifact storage, approval evidence, and
  root-only synthesis. Persona content remains upstream-owned.
