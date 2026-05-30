---
name: review
description: "Use when the user invokes review, mdf review, or asks for a five-axis code review with optional security and performance depth."
---

# review

Use this Codex-native entrypoint when the user invokes `review`, `mdf review`, `$review`, or asks to review current changes.

Invoke the `code-review-and-quality` skill.

This remains a standalone workflow even though `build` may invoke review logic internally. Use `code-review-and-quality` in `standalone` scope for independent verification, manual changes, debugging, PR preparation, merge readiness, and pre-ship checks.

The shared `code-review-and-quality` workflow owns both spec-compliance review and the five-axis code-quality review. When MDF artifacts are available for the current work item, standalone review uses them for spec-compliance context before applying the five-axis review. When no MDF artifacts are available, standalone review falls back to the existing five-axis behavior.

Review the current changes (staged or recent commits) through the shared workflow:

1. **Spec Compliance** — When MDF artifacts exist, does the change satisfy the approved spec, plan, build evidence, and high-risk implementation meaning?
2. **Correctness** — Does it match the spec or task? Edge cases handled? Tests adequate?
3. **Readability** — Clear names? Straightforward logic? Well-organized?
4. **Architecture** — Follows existing patterns? Clean boundaries? Right abstraction level?
5. **Security** — Input validated? Secrets safe? Auth checked? (Use security-and-hardening skill)
6. **Performance** — No N+1 queries? No unbounded ops? (Use performance-optimization skill)

Categorize findings as Critical, Important, or Suggestion.
Output a structured review with specific file:line references and fix recommendations.
Before writing review findings, explanations, or recommendations, follow `../../references/human-facing-language.md`.

When saving the review report, resolve the current MDF work item and write `.mdf/work/{work_id}/review-NNN.md`. Update `item.md` `latest.review` and `.mdf/index.jsonl`.
