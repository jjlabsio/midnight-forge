---
name: auto-workflow
description: "Use when the user asks MDF to run the approved workflow automatically through PR preparation."
---

# auto-workflow

Load the plugin-installed `../../references/auto-workflow-contract.md` before
starting. The root must issue and persist a validated handoff record before
downstream skills may bypass standalone checkpoints. The contract applies only
to this invocation; standalone MDF and upstream skills retain their own
approval and stop semantics.

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

Before `spec`, evaluate the existing upstream `interview-me` skill's `When to
Use` conditions. Use the machine-checkable `interviewGate` policy when the
runtime is available, then preserve the readable reasons in the work-item log.
Invoke `interview-me` when any condition requires it:

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

## Auto handoff context

Pass the canonical `../../references/auto-workflow-handoff-schema.json` record
plus its `handoffRecord.path` and `handoffRecord.sha256` pointer to every
downstream skill and subagent. Persist the record at
`.mdf/work/{work_id}/handoff-NNN.json`; do not maintain a second handoff field
list in this skill.

`mode: auto-workflow` plus a verifier-approved root-issued handoff is required
to bypass only ceremonial standalone checkpoints. A missing, stale, or
conflicting context uses standalone rules.
Any change to spec/plan bytes, path, scope, or task order invalidates the
corresponding continuation authorization and requires a new revision.

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

For read-only codebase exploration, consult the central routing reference and
prefer the exploration candidate only when capability and transport are
verified. It has no authority for design, security, implementation,
lifecycle, or external actions. If unavailable, use the approved fallback or
root fallback and record the result as fallback/degraded where applicable.

## Defensive parallel writers

The default is one writer per worktree. Before starting a parallel writer
group, construct task facts containing `dependsOn`, normalized `ownedPaths`,
worktree/branch/base revision, lock ownership, shared-contract flags, and
independence evidence. Evaluate them with
`./scripts/auto-workflow-policy.js`'s `parallelWriterEligibility`.

Only an eligible group may run in parallel. The proof must establish:

- pairwise disjoint owned paths, including directory-prefix overlap;
- no dependency edge within the group;
- no shared API/type contract, generated output, lockfile, migration, global
  config, fixture, external resource, or `.mdf` state;
- distinct clean isolated worktrees, branches, and task locks from one base;
- an explicit independence review with evidence.

Missing or unknown evidence falls back to serial execution. Each writer owns
only its task paths. The root remains the only writer of canonical state and
the only merger. Validate every returned diff, merge sequentially, and run the
complete verification matrix before external mutation. A semantic conflict or
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
