---
name: use-mdf
description: "Use before software development workflow decisions in Codex or MDF."
---

# Use MDF

MDF is a routing and context layer over agent-skills, not a fork of its
primitive workflows. Resolve the installed skill or reference location before
loading a skill, persona, documentation file, or supporting material. Do not
rely on a fixed cache path; unresolved paths are a stop.

## Routing

Route public MDF commands to their named skills (`spec`, `plan`, `build`,
`review`, `auto-workflow`, `code-simplify`, `ship`, `webperf`, task, and Git
skills), then load every applicable exact upstream primitive. Keep
`using-agent-skills` as a separately accessible exact upstream primitive;
`use-mdf` does not replace its skill discovery, lifecycle stages, or Definition
of Done.

Select all applicable upstream skills, including UI, API, source-driven,
security, observability, documentation, debugging, and migration workflows
when their trigger conditions apply. MDF may add canonical artifact storage,
language, lifecycle state, and runtime adaptation as written guidance, but it
does not replace semantic judgment with a workflow runtime or a JSON command
contract. The model owns routing, ambiguity handling, destructive confirmation,
and user authority.

## Central subagent dispatch

When a selected skill delegates to a subagent, load the plugin-installed
`../../references/subagent-dispatch-policy.md` and
`../../references/model-routing-5.6.md`. The root classifies difficulty and
risk, verifies the available GPT-5.6 capability, and chooses among the Sol,
Terra, and Luna profiles using the chart-derived prior and its own judgment of
the task. This is dynamic selection, not a fixed task-to-model table or a
measured quality/cost calculation. Fast, speed-only, older, and unreviewed
future profiles are never eligible.

Pass the root-selected dispatch record plus the exact persona prompt to the
generic runtime spawn path. Persona model or effort frontmatter is a default
for ordinary direct invocation; the root-selected record overrides it for MDF
dispatch while preserving the persona's perspective. If GPT-5.6 capability
cannot be verified, stop or use a root fallback with an explicit degraded
status; never hide the fallback. Root-only synthesis owns reports, artifacts,
and lifecycle state.

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
