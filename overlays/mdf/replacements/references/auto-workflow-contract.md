# Auto-workflow contract

This is a readable, run-scoped contract for the root AI. It applies only when
the user invokes `mode: auto-workflow`; it does not change the standalone
meaning of any upstream skill or MDF command.

## Handoff context

The root keeps a concise Markdown handoff note under the canonical work item.
The note records the settled intent, current phase, assumptions, applicable
MDF skills, allowed external actions, relevant artifact paths, subagent
reports, and capability or fallback decisions. Downstream skills receive the
note as bounded context and re-read the actual task, Git, and artifact state
before making decisions.

This is model-led context, not a JSON protocol, script-enforced schema, hash
gate, or lifecycle controller. A missing, stale, or conflicting note causes
the root to reassess the actual state and use standalone rules where the auto
contract no longer applies.

## Mandatory intent preflight

At the beginning of an auto-workflow run, read the existing upstream
`interview-me` skill and evaluate its `When to Use` conditions. Invoke it when
any of the following is true:

- the ask is missing its user/target, purpose, success condition, or binding
  constraint;
- the request has more than one materially different interpretation;
- the root would need an unsurfaced assumption before spec, plan, or code;
- two reasonable optimization goals conflict and the user has not chosen one;
- the root cannot defend at least 95% confidence in the next three answers;
- the user explicitly asks to be interviewed.

Do not invoke it for an unambiguous, self-contained mechanical operation or
when the user explicitly asks for speed over verification and no ambiguity
condition remains. A short request can pass when repository evidence makes its
target and outcome unique. A long request can still require an interview. If
the run is not interactive and the intent requires an interview, stop rather
than guessing.

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

Auto mode replaces only ceremonial repeated approvals after its intent gate. It
does not auto-accept a product decision, public-contract change, security or
privacy boundary, permission change, destructive data operation, material cost
change, unknown external target, failed verification, or repeated no-progress.
Routine implementation details and reversible repairs are decided by the root,
recorded as assumptions, verified, and continued without asking.

## Subagent dispatch

All lifecycle phases may use subagents through the central readable dispatch
policy. Read-only exploration returns only bounded evidence and never writes
shared artifacts or advances state. The root synthesizes every report and
records capability, fallback, and degraded status. Subagents do not spawn
other subagents.

Quality-critical work uses GPT-5.6 by default. For narrow, read-only,
report-only codebase exploration, consult the central routing policy and
performance reference, then use the exact model `gpt-5.3-codex-spark` with its
highest supported reasoning setting when compatible transport is available.
Spark is never authoritative for design, security, implementation, lifecycle,
or external mutation decisions. If it is unavailable or incompatible, the root
chooses a suitable GPT-5.6 read-only fallback or performs the exploration
itself. Never use a `fast` option or speed-only profile for any model.

## Defensive writer parallelism

The default is one writer per worktree. Parallel writers are allowed only when
the root can explain all of the following in its readable notes:

- an explicit dependency-free parallel group;
- owned paths are disjoint, including directory-prefix overlap;
- no shared API/type contract, generated output, lockfile, migration, global
  config, fixture, external resource, or `.mdf` state;
- every writer has a distinct clean worktree, branch, and task lock from the
  same base revision;
- no task consumes another parallel task's output;
- an independence review supports the decision.

Missing evidence, unknown coupling, path overlap, shared state, or a merge
conflict changes the execution mode to serial. Parallel workers never write
canonical `.mdf` state, never share a worktree, and never push or create PRs.
The root validates each returned diff, merges sequentially, and performs the
relevant verification before external mutation.

## PR idempotency

Before push or PR mutation, recheck branch, remote, clean diff, base
mergeability, authentication, release language, and open-PR state. A push may
be retried with the same commit. A PR create operation must first query for an
existing PR so an uncertain response cannot create a duplicate. After the PR
URL or failure is recorded, stop the lifecycle; merge and deploy remain later,
separate actions.
