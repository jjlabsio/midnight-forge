---
name: code-simplify
description: "Simplify code for clarity and maintainability — reduce complexity without changing behavior"
---

# code-simplify

## Upstream command contract

Invoke the `code-simplification` skill.

Simplify recently changed code, or the specified scope, while preserving exact
behavior:

1. Read `AGENTS.md` and study project conventions.
2. Identify the target code: recent changes unless a broader scope is
   specified.
3. Understand the code's purpose, callers, edge cases, and test coverage
   before touching it.
4. Scan for simplification opportunities:
   - Deep nesting → guard clauses or extracted helpers.
   - Long functions → split by responsibility.
   - Nested ternaries → `if`/`else` or `switch`.
   - Generic names → descriptive names.
   - Duplicated logic → shared functions.
   - Dead code → remove after confirming.
5. Apply each simplification incrementally and run tests after each change.
6. Verify that all tests pass, the build succeeds, and the diff is clean.

If tests fail after a simplification, revert that change and reconsider. Use
`code-review-and-quality` to review the result.

Resolve the installed plugin root, load the exact upstream
`../code-simplification/SKILL.md`, and preserve its workflow. Read `AGENTS.md`,
the relevant project documentation, and established conventions first.
Simplify only the approved scope, work incrementally, run upstream verification,
and use `../code-review-and-quality/SKILL.md` for the follow-up review.

Start only from the current stable whole-build result and the exact approved
specification/plan. The model determines eligible production paths from the
reviewed diff and task-owned commits. Exclude tests, vendor, generated files,
public workflow contracts, and unrelated changes unless the user explicitly
approves a different scope.

In `mode: auto-workflow`, the run-scoped authorization removes the ceremonial
step-by-step confirmation for behavior-preserving candidates. The root may
delegate read-only candidate discovery and verification, but canonical state
and accepted refactor commits remain root-owned. A candidate that changes a
public contract, security boundary, or destructive behavior remains a stop.

For each behavior-preserving candidate:

1. State the candidate, expected behavior preservation, and affected paths.
2. Change only the candidate paths and run focused verification.
3. Review the candidate against the full specification and upstream
   simplification criteria.
4. If accepted, stage only those paths and create one focused `refactor:`
   commit, then rerun the complete whole-build matrix and final review.
5. If rejected or if no candidate is accepted, discard only the candidate
   change, verify the exact prior clean baseline and exact unchanged HEAD, and
   record a readable no-change note. Never discard unrelated work.

If a candidate fails verification or review, preserve and reproduce the
failure, explain the finding, and either repair it through the ordinary TDD
loop or reject it. Do not modify tests merely to make a refactor pass. A
destructive cleanup, public-contract change, or materially ambiguous behavior
remains a user-decision stop in every mode. Routine simplification ambiguity is
resolved by the root and recorded as an assumption.
