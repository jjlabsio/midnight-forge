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
