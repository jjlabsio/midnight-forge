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

## Review context modes and ownership

`review context` uses a review-specific resolver. Stateful controllers such as
`context`, `spec`, `plan`, `build-task`, `whole-build`, `simplify`, `ship`, and
`github-pr` continue to use the strict active-lock resolver. The review
resolver separates task identity from active ownership so a completed task can
be reviewed read-only after its lock is removed; it never recreates, deletes,
or mutates a task lock or task card.

The resolver owns exactly two review modes:

- `lifecycle-review` is the full lifecycle path. It requires the current
  registered spec and plan, stable whole-build evidence, simplification
  evidence, a clean tree, and fresh provenance-bound sidecars.
- `task-review` is a standalone direct-task path. It is eligible only when no
  lifecycle marker exists, requires the task card plus exact Git, diff, and
  successful verification evidence, and cannot create lifecycle evidence or
  advance to ship.

The resolved `review_mode` is authoritative. Registration records it in the
final decision; caller-supplied provenance or mode relabeling is rejected.
Lifecycle transitions and ship consumers accept only `lifecycle-review`
provenance, so direct task-review output cannot be promoted by filename or
caller assertion.

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
