---
name: use-mdf
description: "Use before software development workflow decisions in Codex or MDF."
---

# Use MDF

MDF is a routing and context layer over agent-skills, not a fork of its
primitive workflows. Resolve the installed skill or reference location before
loading a skill, persona, documentation file, or supporting material. Do not
rely on a fixed cache path; unresolved paths are a stop.

When the caller carries `mode: auto-workflow`, also load
`../../references/auto-workflow-contract.md`. This mode grants in-scope MDF
skill invocation and the explicitly listed push/PR handoff, but it does not
change standalone skill semantics or authorize merge, deploy, deletion, or
stale-lock takeover.
Use the readable run handoff and the current task, Git, and artifact state
before using any auto-only checkpoint bypass. A bare mode string without the
run-scoped context follows standalone rules.

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
`../../references/model-routing-5.6.md` plus
`../../references/model-routing-performance.md`. The root classifies
difficulty, risk, ambiguity, novelty, and consequence, then uses the
performance document as qualitative cost/intelligence context. GPT-5.6 is the
default family. Only narrow, read-only, report-only codebase exploration may
use the exact `gpt-5.3-codex-spark` model with its highest supported reasoning
setting. This is dynamic selection, not a fixed task-to-model table or a
runtime benchmark calculation.

Pass the root-selected model choice, exact persona prompt, and bounded task
input through the generic runtime spawn path. Persona model settings are a
default for ordinary direct invocation; the root's readable choice governs MDF
dispatch while preserving the persona's perspective. Never select or pass a
`fast` option or speed-only profile for any model. If Spark is unavailable or
transport-incompatible, use a GPT-5.6 read-only fallback or perform the
exploration in the root and record degraded status. Root-only synthesis owns
reports, artifacts, and lifecycle state.

## Executor and persona adapter

The root assesses executor capability instead of hard-coding a model choice.
When a generic subagent is appropriate, it receives the selected persona
prompt from the plugin root plus bounded task inputs. If that capability is
unavailable or uncertain, the root fallback performs quality-critical work;
record degraded status rather than claiming independent freshness. One writer
operates in each shared worktree; auto-workflow may use multiple isolated
worktrees only when the root can explain why the work is independent. Root-only
synthesis owns artifacts and lifecycle advance.

## DDD parity

For every non-trivial decision, delegate to the exact upstream
`doubt-driven-development` primitive. Preserve its full
`CLAIM -> EXTRACT -> DOUBT -> RECONCILE -> STOP` workflow, its interactive
cross-model offer and per-invocation authorization, non-interactive announced
skip, degraded fallback label, and hard three cycles bound.
