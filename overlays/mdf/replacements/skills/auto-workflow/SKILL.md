---
name: auto-workflow
description: "Use when the user asks MDF to run the approved workflow automatically through PR preparation."
---

# auto-workflow

Load the plugin-installed `../../references/auto-workflow-contract.md` before
starting. The contract applies only to this invocation; standalone MDF and
upstream skills retain their own approval and stop semantics.

The root runs the in-scope MDF lifecycle as one bounded execution:

```text
intent preflight -> interview-me when required -> spec -> plan ->
build/test -> task review -> whole-build review -> code-simplify -> ship ->
github-commit -> push -> github-pr create/update
```

All applicable MDF skills may be loaded during this run, including debugging,
security, API/UI, source-driven, documentation, observability, and migration
skills. The initial auto invocation authorizes those in-scope skill calls and
the final push/PR create-or-update. It does not authorize merge, deploy, data
deletion, branch/worktree deletion, stale-lock takeover, force operations, or
unrelated cleanup.

## Mandatory intent preflight

Before `spec`, read the upstream `interview-me` skill and evaluate its `When to
Use` conditions. This is a model judgment recorded in the readable work-item
notes, not a scripted gate. Invoke `interview-me` when any condition requires
it:

- missing user/target, purpose, success condition, or binding constraint;
- materially different interpretations are possible;
- an unsurfaced assumption is required;
- conflicting optimization goals have no user choice;
- confidence is below 95% for the next three answers;
- the user explicitly requested an interview.

Do not invoke it for a clear, self-contained mechanical operation. Request
length alone is not a reason to skip or invoke it. `interview-me` requires a
live user; in a non-interactive run, stop with the exact missing information.
Its explicit intent confirmation is the only semantic confirmation before
spec. Do not turn it into a fake spec or plan approval.

## Readable run handoff

Create a concise Markdown handoff note under the canonical work item and pass
its contents as context to downstream skills and subagents. Record the run's
intent, current phase, assumptions, applicable MDF skills, allowed external
actions, relevant artifact paths, and any capability or fallback decision.

The handoff is readable workflow context, not a JSON protocol, hash gate, or
runtime authority verifier. The root AI owns the note, updates it when the
phase or scope changes, and re-reads the actual task, Git, and artifact state
before continuing. A changed spec, plan, scope, or task order requires the root
to reassess the handoff rather than treating the old note as approval.

## Subagent orchestration

Use subagents for bounded work throughout the lifecycle to preserve root
context. Run independent read-only investigations in parallel and return
compact reports with paths, facts, findings, confidence, and next action.
Subagents do not spawn other subagents, write canonical `.mdf` state, or
advance lifecycle state.

Recommended fan-out:

- before spec: codebase exploration and risk/scope research;
- before plan: architecture, dependency, and test-strategy research;
- per task: implementation worker plus read-only test/impact analysis;
- per task and final review: code, security, and test reviewers;
- ship: the existing parallel code-reviewer, security-auditor, and
  test-engineer fan-out.

For read-only codebase exploration, follow the central routing policy and its
performance reference. Use the exact `gpt-5.3-codex-spark` model with its
highest supported reasoning setting when compatible transport is available.
Spark is report-only and has no authority for design, security, implementation,
lifecycle, or external actions. If unavailable or incompatible, choose a
GPT-5.6 read-only fallback or do the exploration in the root and record the
degraded result. Never select or pass a `fast` option or speed-only profile.

## Review and first-slice validation

Review execution is mandatory. This includes the existing task review and
whole-build review; a simple task is not a reason to skip them. An
`independent reviewer` is an additional fresh-context reviewer, so omitting
that subagent is not the same as omitting review. The root may perform a
single-pass review for a mechanical, non-user-facing, low-risk change. Use an
independent reviewer when the change affects a user-facing or core flow, a
public API or data contract, security or permissions, or when risk or intent
is materially uncertain. Decide from user impact, risk, and uncertainty, not
changed-line count, and do not spawn another reviewer just to repeat the same
finding.

After the first meaningful task or vertical slice reaches the normal
build/test checkpoint (`acceptance/context -> RED -> GREEN -> full test suite
-> build`), validate the result before starting the next plan task. This is a
nested checkpoint in the existing build/test orchestration, not a new
lifecycle phase and not a replacement for task review. Validate the actual
consumer: use the browser-testing skill for UI changes and attach a screenshot
plus relevant runtime evidence, inspecting console, network, or accessibility
when affected; use the real CLI, API, or integration boundary for other
changes. Add or run one minimal Playwright E2E smoke path for a critical user
flow that exercises the changed behavior, including any changed integration
boundary. Purely visual or non-critical changes need browser evidence only and
do not require E2E. Pass the resulting evidence, including screenshot paths
when applicable, to the task review and PR handoff. Then continue the existing
`review/gates -> commit -> complete` steps; do not start the next plan task
until those steps pass.

This checkpoint must not modify the standalone build or test skill contract,
their overlays, or the upstream agent-skills source. If the observed result
does not support the intended user value, record the finding through the
existing review once and stop to re-plan or request a decision; do not enter
an automatic fix-and-retest loop.

Only promote a review finding into a new test or production change when it is
directly tied to acceptance criteria, an existing supported contract or
regression, security or permissions, or data integrity. Record and defer
unrelated, speculative, or purely mechanical suggestions without expanding
the implementation.

## Defensive parallel writers

The default is one writer per worktree. Before using parallel writers, the root
AI must reason through dependency-free tasks, disjoint owned paths, isolated
worktrees and branches from one base, distinct locks, and the absence of shared
contracts, generated outputs, lockfiles, migrations, global configuration,
fixtures, external resources, or `.mdf` state.

If any independence fact is unknown or uncertain, use serial execution. Each
writer owns only its task paths. The root remains the only writer of canonical
state and the only merger. Review every returned diff, merge sequentially, and
run the relevant verification before external mutation. A semantic conflict or
scope violation is a blocker; a mechanical, in-scope conflict may be repaired
and reverified automatically.

## Progress and stops

Continue automatically for routine implementation choices, tests, docs,
reversible internal refactors, actionable in-scope review findings, and
transient failures with a safe retry. Record assumptions and evidence.

Stop for:

- unresolved intent or a user product decision;
- public-contract, security, privacy, data, permission, or material cost
  changes;
- destructive or irreversible work, unknown external targets, or risk
  acceptance;
- malformed or conflicting MDF state, lock ownership, worktree, branch, or
  dependency facts;
- failed verification without an obvious in-scope fix;
- repeated findings, regression, no-progress, or untrusted provenance;
- ship NO-GO/critical findings or unavailable required capability;
- failed or ambiguous GitHub push/PR mutation after safe retries.

Never infer completion from an artifact's existence, a green command, or a
review phrase alone.

## PR handoff

After ship GO, recheck branch, remote, clean diff, base mergeability,
authentication, language, release signal, and open-PR state. Push the current
branch, then update the existing PR or create one if none exists. Query before
retrying an uncertain create result so duplicates cannot occur. After the PR
URL or failure is recorded, stop; do not merge, deploy, or delete anything.
