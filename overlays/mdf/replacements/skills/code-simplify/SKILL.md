---
name: code-simplify
description: "Use when the user invokes code-simplify, mdf code-simplify, or asks to simplify code without changing behavior."
---

# code-simplify

Resolve the installed plugin root, load the exact upstream
`../code-simplification/SKILL.md`, and preserve its workflow. Read `AGENTS.md`
and the established project conventions before changing code. Simplify only the
requested scope, apply changes incrementally with upstream verification, then
use the exact upstream `../code-review-and-quality/SKILL.md` for review.

In the lifecycle, simplification starts only from the current stable
whole-build decision. From the resolved plugin root, call production
`./scripts/mdf-controller.js simplify scope`; the runtime derives eligible
production paths from lifecycle-linked task/refactor commits and excludes
tests, vendor, generated surfaces, and public workflow contracts. Run the exact
upstream simplification primitive against the returned scope, preserving its
raw report, and call `simplify register` with the exact decision.

For each accepted behavior-preserving candidate, call `simplify select`, then
use the ordinary build-task verification, fresh review, downstream-impact,
authorization, and focused commit gate. Only candidate paths may change and
the commit subject must start `refactor:`. The resulting tree returns to full
whole-build verification/review before simplification or later phases proceed.

If there is no accepted change (including rejected candidates), restore and
verify the exact prior clean baseline, obtain a separate upstream code review,
and call `simplify no-change`. Do not retain a failed candidate diff, modify
tests to make a refactor pass, or simplify vendor/generated/public-contract
surfaces.

If an accepted candidate later fails verification or fresh review, call
`simplify reject` while the failure snapshot is still current, using the exact
attempt, failure sidecars, raw rejection report, and semantic decision. Restore
the candidate path to the returned prior HEAD without discarding unrelated
work, then call `simplify rejected`; it succeeds only on the exact clean prior
baseline. Include the returned rejection evidence in the separate no-change
review before calling `simplify no-change`.
