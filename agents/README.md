# MDF Persona Adapter

The canonical agent-skills persona and orchestration guide is generated without
modification at [docs/agents.md](../docs/agents.md). This file records only the
Codex/MDF runtime adapter.

- Resolve persona prompts from the installed plugin root, never from a fixed
  cache location or the user project working directory.
- The upstream Markdown files under `agents/` remain the canonical persona
  prompts. Codex-native custom-agent TOML files under `.codex/agents/` are
  adapters for named invocation, not replacements for or new sources of
  persona content. Their `name`, `description`, and developer instructions
  must stay synchronized with the upstream persona they adapt.
- Codex discovers native custom-agent definitions from the active project's
  `.codex/agents/` or the user's global agents directory; the plugin manifest
  does not register them. If an installation does not place this adapter in a
  Codex-discoverable scope, use the generic persona path.
- Before every delegation, the root loads the plugin-installed
  `../references/subagent-dispatch-policy.md`, considers the GPT-5.6 or
  read-only Spark routing guidance, and passes the root-selected model choice
  through a compatible native named-agent path when that path accepts the
  root dispatch record. Otherwise it uses the generic runtime spawn path.
  Persona selection and model selection are separate concerns.
- A native named-agent call is MDF-compatible only when the runtime accepts
  the root-selected model and native reasoning/service overrides for that
  call. The root must pass those fields explicitly; a persona's static model
  defaults are never evidence that MDF routing was applied.
- The four upstream personas remain byte-identical under this directory.
- A generic subagent receives the exact selected persona prompt and bounded
  task inputs. It reports to the root; it does not write shared artifacts,
  invoke another persona, or advance lifecycle state.
- Auto-workflow may also use a generic read-only `explorer` dispatch for
  bounded codebase inventory. The routing reference may prefer the verified
  exploration candidate for this role only; it has `report-only` authority and
  no write scope, and is never treated as an independent design or security
  decision.
- The root considers capability, uses a root fallback for quality-critical work
  when a suitable worker cannot be selected, and records any degraded
  freshness status honestly.
- MDF-owned persona files remain model-agnostic. User-defined or global persona
  files may declare defaults for ordinary direct invocation, but the root's
  readable MDF choice governs managed delegation.
- The root model owns canonical artifact storage, approval evidence, and
  root-only synthesis. Persona content remains upstream-owned.
