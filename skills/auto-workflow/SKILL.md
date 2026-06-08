---
name: auto-workflow
description: "Use when the user asks MDF to run the full lifecycle automatically through PR preparation."
---

# auto-workflow

Use this skill when the user invokes `auto-workflow`, `mdf auto-workflow`,
`$auto-workflow`, `/mdf:auto-workflow`, asks to run the full MDF lifecycle
automatically, or asks in Korean to run the MDF workflow through PR without
manual checkpoints.

This skill is an orchestration wrapper and state machine. It coordinates the
existing MDF phase skills; it does not replace them.

## Core Rule

Use the actual phase skill for every phase:

```text
spec -> plan -> build with subagents -> review -> ship -> github-pr
```

Do not inline, summarize, abbreviate, duplicate, or replace the instructions of
the delegated phase skills inside this workflow. If a phase needs to run, load
and follow that phase skill:

| Phase | Delegate to | Default auto-workflow behavior |
| --- | --- | --- |
| `spec` | `skills/spec/SKILL.md` | Delegate initial requirement-clarity preflight to the `spec` entrypoint, then create or update the current MDF spec artifact. |
| `plan` | `skills/plan/SKILL.md` | Create or update the current MDF plan artifact. |
| `build with subagents` | `skills/build/SKILL.md` | Build all pending planned tasks with subagent support where the build skill allows it. |
| `review` | `skills/review/SKILL.md` | Run standalone review after build, even though build has internal review gates. |
| `ship` | `skills/ship/SKILL.md` | Run the existing GO/NO-GO ship gate. |
| `github-pr` | `skills/github-pr/SKILL.md` | Delegate all commit, push, task completion, release signal, and PR behavior. |

## Start Point

Before running phases, inspect the current MDF work item artifacts and start
from the first missing or incomplete phase:

1. If no current spec artifact exists, start at `spec`.
2. Else if no current plan artifact exists, start at `plan`.
3. Else if build evidence is missing or the plan still has pending selected
   tasks, start at `build with subagents`.
4. Else if standalone review has not passed with no findings after the latest
   build, start at `review`.
5. Else if no GO ship decision exists after the passing standalone review,
   start at `ship`.
6. Else start at `github-pr`.

Use the delegated skill's own artifact and status rules to decide whether a
phase completed. When the evidence is ambiguous, stop and report exactly what is
missing instead of guessing.

When starting at `spec`, `auto-workflow` must not decide whether the user's
requirements are clear enough itself. Initial requirement-clarity preflight is
owned by the `spec` entrypoint, including any routing to `interview-me` before a
spec is drafted.

When a phase needs to verify durable tracked documentation for architecture,
product, migration, or launch decisions, delegate placement rules to
`skills/documentation-and-adrs/SKILL.md`. Use a fresh, high-confidence
project-local docs profile cache when available; rescan tracked docs policy and
taxonomy when it is missing or stale; stop before tracked docs writes when the
destination remains ambiguous.

## Stop Conditions

Stop immediately when any delegated phase:

- asks for user input
- returns `question needed`
- cannot complete its own gate
- reports failed verification
- encounters malformed or conflicting MDF state
- reaches a git, release, mergeability, or PR ambiguity owned by `github-pr`

Do not duplicate ambiguity handling in this skill. Ambiguous requirements are
owned by `interview-me`, `spec`, and `spec-driven-development`; `auto-workflow`
only stops when a delegated phase asks for input or cannot continue.

### Standalone Review Stop

After `build`, always run standalone `review`.

If standalone `review` reports findings, classify them before deciding whether
to stop:

- **Actionable findings** are findings the agent can fix within the approved
  spec, plan, and current change scope without user judgment. Fix them
  automatically, rerun affected verification, update build or debug evidence
  when needed, and rerun standalone `review`.
- **Decision-required findings** are findings that require user judgment, risk
  acceptance, product or API direction, scope expansion, compatibility tradeoffs,
  data migration decisions, release policy choices, or security/privacy risk
  acceptance. Stop before `ship`, preserve or save the review artifact according
  to the review skill, summarize the decision needed, and ask the user how to
  proceed.
- **Non-blocking findings** are explicitly optional observations that do not
  affect correctness, safety, spec compliance, maintainability, or release
  readiness. Record them in the review artifact and continue only when the
  review verdict still permits proceeding.

Run at most three standalone review fix-loop attempts for the same review gate.
If the same finding recurs, new verification fails, or the loop cannot produce a
passing standalone review within three attempts, stop before `ship` and report
the remaining findings and attempted fixes.

Proceed to `ship` only when standalone `review` returns no findings, or only
explicitly non-blocking findings with a passing review verdict.

### Ship Stop

Proceed to `github-pr` only when `ship` returns GO.

If `ship` returns NO-GO, stop before `github-pr` and report the ship blockers
or risks. Do not create or update a PR while the ship decision is NO-GO.

## Subagent Policy

Invoking `auto-workflow` is explicit authorization for subagent use only where
the delegated phase skill supports subagents and the current runtime exposes the
needed tools.

- `spec`: use `spec`; when subagents are available, use `spec-evaluator` only
  for blocker evaluation of the draft spec. The subagent must not write the
  spec, revise it, save artifacts, or ask the user directly.
- `plan`: use `plan`; when subagents are available, use `plan-evaluator` only
  for blocker evaluation of the draft plan. The subagent must not write the
  plan, revise it, save artifacts, or ask the user directly.
- `build with subagents`: the main agent remains the build orchestrator. Do not
  delegate the entire build phase to one subagent. Subagents may be used only at
  task implementation, task-scope review, whole-build review, or high-risk
  independent review boundaries allowed by `build`, `incremental-implementation`,
  and `code-review-and-quality`.
- `review`: prefer fresh-context or subagent review when available. The subagent
  returns a review report only; the main agent saves artifacts, decides whether
  the workflow stops, and communicates with the user.
- `ship`: use the existing `ship` behavior, including its code-reviewer,
  security-auditor, and test-engineer fan-out. Do not invent another ship
  subagent policy here.
- `github-pr`: do not use a subagent. The main agent owns git status, task
  completion, commit handling, push, release signal handling, and PR creation.

If subagent tooling is unavailable in a phase, fall back to that delegated
phase's existing inline behavior and record unavailable subagent execution
where the phase artifact has a freshness or evidence field.

## Main-Agent Responsibilities

The main agent owns orchestration state:

- current phase selection
- MDF artifact saving through the delegated phase rules
- `item.md` latest pointers
- `.mdf/index.jsonl` updates
- phase advancement based on the delegated `build` skill's task order,
  completion evidence, and stop conditions
- fix-loop decisions after review findings
- git state, commits, pushes, and PR creation through `github-pr`

Do not imply that `auto-workflow` runs in the background. It is an interactive
workflow that continues automatically only while delegated phases complete
successfully and do not require a user decision.

## Completion

The automatic workflow is complete only after `github-pr` reports that a remote
PR was created or that an open PR already exists for the current branch.

Report the completed phases, final PR URL when available, and any verification
or ship evidence produced by delegated phases.
