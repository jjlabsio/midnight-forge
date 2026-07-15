---
name: auto-workflow
description: "Run MDF's local implementation workflow through review, simplification, and commit without ship or PR delivery."
---

# auto-workflow

Use this skill for the repeatable local implementation loop. It is intentionally
separate from `auto-workflow-pr`: this skill does not authorize ship, task
completion, push, or PR creation/update.

Load the plugin-installed `../../references/auto-workflow-contract.md` and use
`mode: auto-workflow` for downstream MDF skills. The contract is run-scoped and
does not grant external GitHub authority in this mode.

## Lifecycle

Run the bounded lifecycle:

```text
intent preflight -> interview-me when required -> spec -> plan ->
build/test -> task review -> whole-build review -> code-simplify -> commit
```

Reuse the current approved spec, plan, task card, worktree, commits, and
handoff evidence when they remain current. If the intent, spec, plan, scope,
or task order is materially changed, reassess the handoff and regenerate the
affected artifact instead of silently continuing with stale evidence.

## Intent preflight

Before `spec`, read the upstream `interview-me` skill and evaluate its existing
`When to Use` conditions. Invoke it when the target, purpose, success
condition, constraint, interpretation, assumption, optimization choice, or
confidence is materially unresolved, or when the user explicitly asks for an
interview. Clear mechanical requests skip the interview. Record the settled
intent in the readable work-item handoff.

## Implementation and completion boundary

For every ready plan task, preserve the full TDD and verification loop:

```text
acceptance/context -> RED -> GREEN -> full test suite -> build ->
review/gates -> code-simplify -> focused commit
```

A plan task is an implementation slice, not the whole MDF task. After the
commit, record the slice's commit and verification evidence, but do not mark
the whole MDF task `done`. Keep the active task ownership needed for a later
`auto-workflow` invocation to continue. Do not release the task lock until the
whole task handoff is complete or the separate PR workflow completes it.

Run the required task review and whole-build review. Fix actionable in-scope
findings, but stop for unresolved product decisions, public-contract changes,
security/privacy/permission boundaries, destructive work, failed verification,
repeated no-progress, or ambiguous task/lock/worktree state.

## Stop boundary

After the local commit and readable handoff, stop. This skill must not:

- invoke `ship`;
- mark the whole MDF task `done`;
- push a branch;
- create or update a GitHub PR;
- merge, deploy, delete, force, or perform unrelated cleanup.

When the user is ready for delivery, invoke `auto-workflow-pr`. That skill may
resume from the latest valid local artifacts and commits rather than repeating
completed implementation work.

## Subagents and review

Use the central MDF dispatch policy for bounded read-only exploration and
review reports. The root agent owns task state, artifact synthesis, shared
writes, commit scope, and lifecycle decisions. Use serial writers unless
independence is proven with disjoint paths, isolated worktrees, locks, and no
shared contracts or generated outputs.

## Required handoff

Record the current phase, settled intent, exact spec/plan paths and hashes,
completed plan slices, commit IDs, verification outcomes, review evidence,
remaining plan work, assumptions, and the explicit fact that ship/push/PR were
not performed. Re-read the actual task, Git, and artifact state before any
continuation.
