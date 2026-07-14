# Auto-workflow contract

This contract applies only when the root invocation carries a validated,
root-issued handoff with `mode: auto-workflow`. The mode string alone never
grants authority. It does not change the standalone meaning of any upstream
skill or MDF command.

## Handoff context

Every downstream MDF skill receives a bounded context containing:

```text
mode
run_id
intent_digest
current_phase
spec_path + spec_sha256
plan_path + plan_sha256
allowed_mdf_skills
allowed_external_actions
rootIssued: true
handoffRecord.path + handoffRecord.sha256
```

Before bypassing any standalone checkpoint, the downstream skill must evaluate
`scripts/auto-workflow-policy.js`'s `autoHandoffGate`, then verify
the handoff record exists under canonical `.mdf`, its bytes match the supplied
SHA-256, the record is root-issued for this run, and the phase/spec/plan hashes
are current. A missing, stale, or conflicting handoff follows standalone rules
and cannot use auto authority.

The root owns this context, canonical `.mdf` state, task locks, lifecycle
advance, synthesis, merge, and external mutations. A downstream skill may
return a report or a bounded task result, but it must not invent authority
from an artifact's existence or from a green command alone.

## Mandatory intent preflight

At the beginning of an auto-workflow run, evaluate the existing upstream
`interview-me` skill's `When to Use` conditions. This is an invocation gate,
not a replacement skill. Invoke `interview-me` when any of the following is
true:

- the ask is missing its user/target, purpose, success condition, or binding
  constraint;
- the request is conventional and has more than one materially different
  interpretation;
- the root would need an unsurfaced assumption before spec, plan, or code;
- two reasonable optimization goals conflict and the user has not chosen one;
- the root cannot defend at least 95% confidence in the next three answers;
- the user explicitly asks to be interviewed.

Do not invoke it for an unambiguous, self-contained mechanical operation or
when the user explicitly asks for speed over verification and no positive
ambiguity condition remains. A short request can pass when repository
evidence makes its target and outcome unique. A long request can still require
an interview. In auto-workflow, a positive ambiguity/material-decision
condition takes precedence over the speed exception because the root may not
guess a critical requirement. If the run is not interactive and the gate
requires an interview, stop rather than guessing.

The interview's explicit intent confirmation is the only semantic confirmation
required before spec in auto mode. It is not reused as a fake spec or plan
approval.

## Auto authority

The initial auto-workflow invocation authorizes all applicable MDF skills needed
for the in-scope lifecycle, including spec, plan, build, test, review,
debugging, security, documentation, simplification, ship, commit, and PR
handoff. It also authorizes these external actions after fresh preflight:

- commit the task-owned changes;
- push the current task branch;
- create or update the corresponding GitHub PR.

It does not authorize merge, deploy, data deletion, branch deletion, worktree
deletion, stale-lock takeover, force operations, or unrelated cleanup.

Auto mode replaces only ceremonial repeated approvals after its intent gate.
It does not auto-accept a product decision, public-contract change, security or
privacy boundary, permission change, destructive data operation, material cost
change, unknown external target, failed verification, or repeated no-progress.
Routine implementation details and reversible repairs are decided by the root,
recorded as assumptions, verified, and continued without asking.

## Subagent dispatch

All lifecycle phases may use subagents through the central dispatch policy.
Read-only exploration returns only bounded evidence and never writes shared
artifacts or advances state. The root synthesizes every report and records
capability, fallback, and degraded status. Subagents do not spawn other
subagents.

The routing reference may prefer GPT-5.3-Codex-Spark for read-only codebase
exploration only when the runtime verifies a compatible transport. Spark is
never authoritative for design, security, implementation, lifecycle, or
external mutation decisions. If the probe fails, use the approved GPT-5.6
fallback or the root with an explicit fallback record.

## Defensive writer parallelism

The default is one writer per worktree. Parallel writers are allowed only
after a proof gate establishes all of the following:

- explicit dependency-free parallel group;
- normalized owned paths are pairwise disjoint, including directory-prefix
  overlap;
- no shared API/type contract, generated output, lockfile, migration, global
  config, fixture, external resource, or `.mdf` state;
- every writer has a distinct clean worktree, branch, and task lock from the
  same base revision;
- no task consumes another parallel task's output;
- an independence review and machine-checkable evidence are present.

Missing evidence, unknown coupling, path overlap, shared state, or a merge
conflict changes the execution mode to serial. Parallel workers never write
canonical `.mdf` state, never share a worktree, and never push or create PRs.
The root validates each returned diff, merges sequentially, runs the complete
verification matrix, and only then performs external mutation.

## PR idempotency

Before push or PR mutation, recheck branch, remote, clean diff, base
mergeability, authentication, release language, and open-PR state. A push may
be retried with the same commit. A PR create operation must first query for an
existing PR so an uncertain response cannot create a duplicate. After the PR
URL or failure is recorded, stop the lifecycle; merge and deploy remain later,
separate actions.
