# MDF Persona Adapter

The canonical agent-skills persona and orchestration guide is generated without
modification at [docs/agents.md](../docs/agents.md). This file records only the
Codex/MDF runtime adapter.

- Resolve persona prompts from the installed plugin root, never from a fixed
  cache location or the user project working directory.
- Before every delegation, the root loads the plugin-installed
  `../references/subagent-dispatch-policy.md`, verifies GPT-5.6 capability,
  and passes the root-selected dispatch record through the generic runtime
  spawn path. Persona selection and model selection are separate concerns.
- The four upstream personas remain byte-identical under this directory.
- A generic subagent receives the exact selected persona prompt and bounded
  task inputs. It reports to the root; it does not write shared artifacts,
  invoke another persona, or advance lifecycle state.
- Auto-workflow may also use a generic read-only `explorer` dispatch for
  bounded codebase inventory. The routing reference may prefer the verified
  exploration candidate for this role only; it has `report-only` authority and
  no write scope, and is never treated as an independent design or security
  decision.
- The root verifies capability, uses root fallback for quality-critical work
  when capability cannot be selected or verified, and records any degraded
  freshness status honestly.
- MDF-owned persona files remain model-agnostic. User-defined or global persona
  files may declare model or effort defaults for ordinary direct invocation, but
  the root-selected MDF dispatch record overrides those defaults.
- The root model owns canonical artifact storage, approval evidence, and
  root-only synthesis. Persona content remains upstream-owned.
