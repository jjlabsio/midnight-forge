---
name: review
description: "Use when the user invokes review, mdf review, or asks for one upstream five-axis review pass."
---

# review

This MDF controller resolves the installed plugin root, loads the exact
upstream `../code-review-and-quality/SKILL.md`, and follows it without adding
or weakening review criteria. Pass canonical MDF spec, plan, build evidence,
and diff as context when they exist; the upstream workflow remains the review
method and verdict contract.

Standalone `review` is one phase and one pass. It saves a canonical
`review-NNN.md` artifact, then stops. A build controller owns any fix,
verification, and re-review loop required before advancement. Use a capability
verified fresh reviewer where upstream freshness is required; otherwise record
the precise degraded/root fallback status rather than mislabeling it.

From the resolved plugin root, call production
`./scripts/mdf-controller.js review context` first. It returns the exact
current spec, plan, lifecycle-linked task/refactor completions, stable
whole-build, simplification result, and tree-bound context paths. Execute one
exact upstream review pass against those paths and preserve its raw output;
never parse headings, phrases, or Markdown to derive a verdict.

Call `review register` with `context_file`, raw `output_path`, provenance-bound
`decision_file`, and `mode`. Standalone mode always stops after that one pass.
In auto mode, a passing semantic decision advances to ship. Findings that need
human judgment stop; bounded findings may create one affected-task attempt and
must then pass the ordinary verification/fresh-review/focused-commit gate and
the full whole-build/simplification cycle again. The semantic decision, not
report grammar, owns that routing.
