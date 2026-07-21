---
name: code-simplify
description: "Simplify code for clarity and maintainability — reduce complexity without changing behavior"
---

# code-simplify

Resolve the installed plugin root; an unresolved root is a stop. Load and run
the exact upstream `../using-agent-skills/SKILL.md` discovery workflow, resolve
this canonical adapter, then load the complete exact upstream
`../code-simplification/SKILL.md`, its required follow-up
`../code-review-and-quality/SKILL.md`, and every other applicable primitive
selected by discovery.

## Upstream command contract

Simplify recently changed code, or the specified scope, while preserving exact
behavior:

1. Read `AGENTS.md`, relevant project documentation, and established project
   conventions.
2. Default to recently changed code unless the caller approves a broader
   scope.
3. Before editing, understand the code's responsibility, callers and callees,
   inputs, outputs, side effects and ordering, error behavior, edge cases, test
   coverage, and historical reason through surrounding code and Git history.
4. Identify concrete opportunities such as deep nesting, long or mixed-purpose
   functions, nested ternaries, boolean flags, repeated conditions, unclear or
   misleading names, duplicated logic, dead code, pass-through wrappers,
   redundant assertions, and speculative abstraction.
5. Prefer faster comprehension and project consistency over cleverness or line
   count. Preserve useful names, testability, extensibility, error handling,
   performance constraints, comments that explain why, and every observable
   behavior.
6. State one candidate's signal, rationale, expected behavior preservation, and
   affected paths. Apply only that candidate, then run and pass the complete
   applicable test suite before considering the next candidate. Focused tests
   or checks may be additional, but never substitute for that complete suite.
7. If a candidate fails or is not a net clarity improvement, safely reject it,
   restore its exact prior baseline, and reconsider. Do not batch unverified
   candidates or discard unrelated work.
8. For a refactor touching more than 500 lines, use a reviewable codemod, AST
   transform, or other automation instead of error-prone manual edits.
9. After the pass, compare before and after, run the complete applicable test
   suite, build, typecheck, linter, and formatter, inspect the clean diff, and
   apply the complete upstream `code-review-and-quality` workflow. All existing
   tests must pass without modification merely to make the refactor succeed.

Do not force a refactor when the code is already clear, its behavior is not
understood, a simpler form would harm a performance constraint, or the code is
about to be replaced. Do not silently delete uncertain dead code. A public
contract or user-visible behavior change, security or privacy boundary,
destructive cleanup, material ambiguity, or required scope expansion is a stop
for user judgment rather than simplification.

## MDF/Codex adaptation

In a plan-backed MDF workflow, start from the current stable whole-build result
and exact approved specification and plan. Derive eligible production paths
from the reviewed diff and task-owned commits. Exclude tests, vendor, generated
files, public workflow contracts, and unrelated changes unless the user
explicitly grants that scope.

### Automatic-stage simplification

When the caller supplies normalized automatic stage context, load the
plugin-installed `../../references/auto-workflow-contract.md` and require
`Stage` to select this canonical `code-simplify` adapter and one exact
plan-backed candidate scope or explicit not-applicable assessment. Apply the
context's acceptance baseline, verification profile, continuity, lease, output
disposition, capabilities, and mandatory Two-Key gate. The context's mode is
provenance only; a raw mode or handoff without normalized context is malformed
and finishes `BLOCKED`. Also load
`../../references/subagent-dispatch-policy.md`,
`../../references/model-routing-5.6.md`, and
`../../references/model-routing-performance.md` before dispatch. Use their
shared Two-Key dispatch, quality-floor, evidence, positive-terminality,
recovery, and root-authority mechanics without duplicating them. Omission is a
root composition decision; an omitted stage is never invoked to create an empty
gate.

When simplification is applicable:

1. Dispatch one bounded producer as the sole writer. It may change only the
   exact approved production candidate paths. It may not change tests, vendor,
   generated files, public workflow contracts, unrelated paths, or any other
   path without explicit authority.
2. The producer follows the complete upstream process one candidate at a time,
   including candidate reasoning, focused checks, exact rejection, final
   applicable test/build/typecheck/lint/format checks, and follow-up review. It
   cannot stage, commit, mutate canonical `.mdf` state, delegate, accept the
   result, advance lifecycle, mutate external state, or perform synthesis.
3. A failed candidate is rejected back to its exact prior baseline or returned
   to the ordinary TDD repair loop when that remains safely in scope. Never
   discard unrelated work or weaken or modify tests to force acceptance.
4. After positive producer terminality, the root observes the actual before and
   after bytes, complete diff, changed and unrelated paths, canonical and Git
   state, and bound command evidence. A distinct fresh-context, read-only,
   non-delegating verifier then assesses that actual result for exact behavior
   preservation, net clarity, project conventions, scope, and current
   verification evidence without receiving producer reasoning.
5. The root alone reconciles `PASS`, `REWORK`, or `BLOCKED`. An accepted change
   invalidates affected build, test, command, internal-review, and downstream
   review evidence; re-enter the earliest owning canonical gates required by
   the shared contract before root review-candidate staging and canonical
   review. The root alone owns any later focused commit.

When no eligible candidate exists, the producer still returns a reasoned
explicit not-applicable or no-change assessment. After positive terminality,
the root binds unchanged bytes, diff, tree, index, and `HEAD` evidence, and the
same independent verifier assesses that actual no-change result. Absence of a
candidate, producer report, or verifier is not a pass.

Material ambiguity or a public, security, privacy, destructive, or
out-of-authority candidate returns its evidence under the shared automatic
stage stop rules; it does not become permission to broaden the producer lease.
Only the root chooses recovery or a new stage context. Routine candidate choice
inside the leased settled scope remains model judgment recorded as an
assumption.

### Standalone result

Standalone invocation keeps the upstream interaction and stop semantics. For
each accepted behavior-preserving candidate, stage only its paths and create
one focused `refactor:` commit, then rerun the complete whole-build matrix and
final review. If a candidate is rejected or no candidate is accepted, restore
and verify its exact prior clean baseline and unchanged `HEAD`, record a
readable no-change note, and leave unrelated work untouched. A failed candidate
may instead enter the ordinary TDD repair loop when the user authorizes that
behavioral work; it is never hidden as a successful simplification.
