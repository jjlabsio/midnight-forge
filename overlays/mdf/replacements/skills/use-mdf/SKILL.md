---
name: use-mdf
description: "Use before software development workflow decisions in Codex or MDF."
---

# Use MDF

## Router boundary and mode authority

- Treat MDF as a routing and context layer over `agent-skills`, not a fork of
  its primitive workflows.
- Resolve the installed skill or reference location before loading a skill,
  persona, documentation file, or supporting material.
- Do not rely on a fixed cache path. Stop when the location cannot be resolved.

For `mode: auto-workflow`, `mode: auto-workflow-pr`, or
`mode: quick-workflow-pr`:

1. Load `../../references/auto-workflow-contract.md`.
2. Grant local mode only in-scope MDF implementation skills and local commits.
3. Grant PR modes only the explicitly listed push/PR handoff.
4. Never authorize merge, deploy, deletion, or stale-lock takeover.
5. Read the run handoff plus current task, Git, and artifact state before using
   an auto-only checkpoint bypass.
6. Treat a bare internal mode string without run-scoped context as a stop. Only
   a direct user invocation of the named standalone skill follows standalone
   rules.

## Routing

1. Route public MDF commands to their named skills:
   - `spec`, `plan`, `build`, `review`;
   - `auto-workflow`, `auto-workflow-pr`, `quick-workflow-pr`;
   - `code-simplify`, `ship`, `webperf`, and task skills;
   - Git skills.
2. Load every applicable exact upstream primitive after routing.
3. Keep `using-agent-skills` separately accessible as the exact upstream
   primitive. `use-mdf` does not replace its skill discovery, lifecycle stages,
   or Definition of Done.
4. Select every other applicable upstream skill when its trigger applies,
   including UI, API, source-driven, security, observability, documentation,
   debugging, and migration workflows.
5. Allow MDF to add canonical artifact storage, language, lifecycle state, and
   runtime adaptation as guidance only. Do not replace semantic judgment with a
   workflow runtime or JSON command contract.
6. Keep routing, ambiguity handling, destructive confirmation, and user
   authority in the model's control.

## Central subagent dispatch

When a selected skill delegates to a subagent:

1. Load the plugin-installed
   `../../references/subagent-dispatch-policy.md` and
   `../../references/model-routing-5.6.md`.
2. Have the root classify difficulty and risk.
3. Verify available capability.
4. Choose among reviewed quality-critical candidates or the narrow read-only
   exploration candidate using the documents' routing guidance and task
   judgment.
5. Keep selection dynamic. Do not use a fixed task-to-model table or a measured
   quality/cost calculation.
6. Use GPT-5.6 for quality-critical work. A narrow read-only exploration may
   prefer `gpt-5.3-codex-spark`.
7. Pass the root-selected model, exact persona prompt, and bounded task input
   through the generic runtime spawn path.
8. Treat persona model settings as ordinary direct-invocation defaults; the
   root's readable choice governs MDF dispatch while preserving the persona's
   perspective.
9. If quality-critical GPT-5.6 capability is unavailable or uncertain, stop or
   use a root fallback with explicit degraded status. Never hide the fallback.
10. Allow a read-only explorer to use the routing reference's preference only
    when the root judges the transport compatible.
11. Keep report, artifact, and lifecycle synthesis in the root context.

## Executor and persona adapter

1. Assess executor capability instead of hard-coding a model choice.
2. Give the generic subagent the selected persona prompt from the installed
   plugin root, bounded task inputs, and root dispatch record.
3. If capability, prompt resolver, or transport is unavailable or uncertain,
   use the root fallback for quality-critical work and record degraded status;
   do not claim independent freshness.
4. Keep one writer in each shared worktree.
5. Allow `auto-workflow` and `auto-workflow-pr` to use multiple isolated
   worktrees only when the root explains why the work is independent.
6. Keep artifact and lifecycle synthesis in the root context.

Apply the installed `subagent-dispatch-policy` completion gate:

- Consume only actual returned worker reports.
- For independent fan-out, join every required report before synthesis or a
  normal GO decision.
- Route policy-defined incomplete results through the caller's explicit
  degraded/stop path.

## DDD parity

For every non-trivial decision:

1. Delegate to the exact upstream `doubt-driven-development` primitive.
2. Preserve the full `CLAIM -> EXTRACT -> DOUBT -> RECONCILE -> STOP` workflow.
3. Preserve its interactive cross-model offer and per-invocation authorization.
4. Preserve its non-interactive announced skip and degraded fallback label.
5. Preserve its hard three-cycle bound.
