# MDF Persona Adapter

The canonical agent-skills persona and orchestration guide is generated without
modification at [docs/agents.md](../docs/agents.md). This file records only the
Codex/MDF runtime adapter.

- Resolve persona prompts from the installed plugin root, never from a fixed
  cache location or the user project working directory.
- Before every delegation, the root loads the plugin-installed
  `../references/subagent-dispatch-policy.md`,
  `../references/model-routing-5.6.md`, and
  `../references/model-routing-performance.md`. GPT-5.6 is the default; only
  narrow, read-only, report-only exploration uses the exact
  `gpt-5.3-codex-spark` model with its highest supported reasoning setting.
  The root passes that choice through the generic runtime spawn path. Persona
  selection and model selection are separate concerns.
- The four upstream personas remain byte-identical under this directory.
- A generic subagent receives the exact selected persona prompt and bounded
  task inputs. It reports to the root; it does not write shared artifacts,
  invoke another persona, or advance lifecycle state.
- Auto-workflow may also use a generic read-only `explorer` dispatch for
  bounded codebase inventory. The performance reference informs the root's
  cost/intelligence judgment, but Spark has `report-only` authority and no
  write scope, and is never treated as an independent design or security
  decision. No model may use a `fast` option or speed-only profile.
- The root considers capability, uses a root fallback for quality-critical work
  when a suitable worker cannot be selected, and records any degraded
  freshness status honestly.
- MDF-owned persona files remain model-agnostic. User-defined or global persona
  files may declare defaults for ordinary direct invocation, but the root's
  readable MDF choice governs managed delegation.
- The root model owns canonical artifact storage, approval evidence, and
  root-only synthesis. Persona content remains upstream-owned.
