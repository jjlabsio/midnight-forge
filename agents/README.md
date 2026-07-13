# MDF Persona Adapter

The canonical agent-skills persona and orchestration guide is generated without
modification at [docs/agents.md](../docs/agents.md). This file records only the
Codex/MDF runtime adapter.

- Resolve persona prompts from the installed plugin root, never from a fixed
  cache location or the user project working directory.
- The four upstream personas remain byte-identical under this directory.
- A generic subagent receives the exact selected persona prompt and bounded
  task inputs. It reports to the root; it does not write shared artifacts,
  invoke another persona, or advance lifecycle state.
- The root verifies capability, uses root fallback for quality-critical work
  when capability cannot be selected or verified, and records any degraded
  freshness status honestly.
- The root model owns canonical artifact storage, approval evidence, and
  root-only synthesis. Persona content remains upstream-owned.
