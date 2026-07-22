---
name: use-mdf
description: "Use before software development workflow decisions in Codex or MDF."
---

# Use MDF

## Discovery and named routing

1. Resolve the installed plugin root before loading any skill, persona,
   reference, or supporting file. Stop when it cannot be resolved; never rely
   on a fixed cache path.
2. Load and run the exact upstream `../using-agent-skills/SKILL.md` discovery
   workflow first. Load every other applicable upstream primitive it selects,
   then resolve the canonical MDF adapter for the user's intent.
3. Route public MDF commands to their named adapters: `spec`, `plan`, `build`,
   `test`, `review`, `code-simplify`, `ship`, `webperf`, task and Git skills,
   and `auto-workflow`, `auto-workflow-pr`, or `quick-workflow-pr`.
4. Treat MDF as routing, context, state, and authority guidance over upstream
   primitives, not a fork or replacement for their workflow, interaction,
   verification, fallback, stop, or Definition of Done semantics.
5. Keep applicability, ambiguity, destructive confirmation, and user or
   external authority in the root model. Do not add a runtime controller,
   state machine, machine-only protocol, router persona, or paraphrasing
   lifecycle agent.

## Automatic entrypoints

For any automatic mode, load
`../../references/auto-workflow-contract.md` after exact discovery and route to
the matching named entrypoint with its current readable handoff. A bare mode
string or missing handoff is a stop. The shared contract and canonical
consumers are authoritative for the complete automatic-mode behavior; do not
restate or replace it here.

The root entrypoint is the only layer that interprets the mode. For every
selected stage, re-read canonical and Git state and create the contract's
normalized Markdown stage context: stage, acceptance baseline, verification
profile, continuity, lease and role, output disposition, capabilities and
authority, and provenance. Pass that context—not a raw mode branch—to the
canonical stage skill. Mode remains provenance only. Missing or contradictory
context finishes `BLOCKED`; never ask a stage skill to infer composition,
omission, ordering, authority, or recovery from a mode name.

Classify lifecycle and authority at the router only:

- `auto-workflow` is local-only and omits ship, whole-task completion, push,
  PR mutation, and PR consumer checks.
- `auto-workflow-pr` is the plan-backed delivery entrypoint with only its
  explicit push and PR handoff externally authorized.
- `quick-workflow-pr` is the explicitly selected bounded delivery entrypoint;
  it omits specification, planning, simplification, and ship and grants only
  its explicit push and PR handoff externally.

Root-only ownership never substitutes for a missing model-led gate. Merge,
deploy, deletion, stale-lock takeover, force operations, and unrelated cleanup
remain unauthorized.

## Central subagent dispatch

Whenever a canonical skill delegates, load the plugin-installed
`../../references/subagent-dispatch-policy.md`,
`../../references/model-routing-5.6.md`, and
`../../references/model-routing-performance.md`.

- Let the root select reviewed capability dynamically from task difficulty,
  risk, ambiguity, novelty, consequence, required quality, runtime capability,
  transport compatibility, and the qualitative performance reference. Do not
  use a fixed task-to-model table, measured quality/cost formula, fast profile,
  benchmark equivalence, or silent downgrade.
- Automatic canonical stage workers use the `skill-backed` instruction source:
  pass the exact canonical adapter and applicable upstream primitives without
  resolving a persona. Use `persona-backed` only when the delegating skill
  explicitly names an existing specialist and requires its exact installed
  `agents/<persona>.md` prompt.
- Automatic `ship` is a root-owned existing specialist fan-out exception, not a
  nested skill-backed worker; the root dispatches its named personas directly
  and performs the upstream GO/NO-GO synthesis.
- Let the delegating canonical skill, shared contract, and installed references
  own all worker-level execution and gate details.
- Keep one writer per shared worktree. Keep intent, authority, canonical state,
  artifact acceptance, commits, lifecycle, external actions, returned-report
  acceptance, and final synthesis in the root.
