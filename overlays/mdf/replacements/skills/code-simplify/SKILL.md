---
name: code-simplify
description: "Use when the user invokes code-simplify or asks to simplify code without changing behavior."
---

# code-simplify

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
destructive cleanup, public-contract change, or ambiguous behavior stop needs
current user confirmation.
