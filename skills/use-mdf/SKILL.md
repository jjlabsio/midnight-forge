---
name: use-mdf
description: "Use before software development workflow decisions in Codex or MDF."
---

# Use MDF

MDF is a controller layer over agent-skills, not a fork of its primitive
workflows. Resolve the installed plugin root from the loaded skill before
loading a skill, reference, persona, documentation file, or supporting script.
Do not rely on a fixed cache path; unresolved paths fail validation.

## Routing

Route public MDF commands to controllers (`spec`, `plan`, `build`, `review`,
`auto-workflow`, `code-simplify`, `ship`, `webperf`, task and git controllers),
then load every applicable exact upstream primitive. Keep `using-agent-skills`
as a separately accessible exact upstream primitive; `use-mdf` does not replace
its skill discovery, lifecycle stages, or Definition of Done.

Select all applicable upstream skills, including UI, API, source-driven,
security, observability, documentation, debugging, and migration workflows
when their trigger conditions apply. MDF may add canonical artifact storage,
language, lifecycle state, and runtime adaptation only in controllers.

## Executor and persona adapter

The root verifies executor capability instead of hard-coding a model name. When
a generic subagent is appropriate, it receives the exact selected persona prompt
from the plugin root plus bounded task inputs. If that capability is unavailable
or cannot be verified, the root fallback performs quality-critical work; record
degraded status rather than claiming independent freshness. One writer operates
in a shared worktree; root-only synthesis owns artifacts and lifecycle advance.

## DDD parity

For every non-trivial decision, delegate to the exact upstream
`doubt-driven-development` primitive. Preserve its full
`CLAIM -> EXTRACT -> DOUBT -> RECONCILE -> STOP` workflow, its interactive
cross-model offer and per-invocation authorization, non-interactive announced
skip, degraded fallback label, and hard three cycles bound.
