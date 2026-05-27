---
name: review
description: "Use when the user invokes review, mdf review, or asks for a five-axis code review with optional security and performance depth."
---

# review

Use this Codex-native entrypoint when the user invokes `review`, `mdf review`, `$review`, or asks to review current changes.

Invoke the `code-review-and-quality` skill.

This remains a standalone workflow even though `build` may invoke review logic internally. Use it for independent verification, manual changes, debugging, PR preparation, and pre-ship checks.

Review the current changes (staged or recent commits) across all five axes:

1. **Correctness** — Does it match the spec? Edge cases handled? Tests adequate?
2. **Readability** — Clear names? Straightforward logic? Well-organized?
3. **Architecture** — Follows existing patterns? Clean boundaries? Right abstraction level?
4. **Security** — Input validated? Secrets safe? Auth checked? (Use security-and-hardening skill)
5. **Performance** — No N+1 queries? No unbounded ops? (Use performance-optimization skill)

Categorize findings as Critical, Important, or Suggestion.
Output a structured review with specific file:line references and fix recommendations.
Before writing review findings, explanations, or recommendations, follow `../../references/human-facing-language.md`.

When saving the review report, resolve the current MDF work item and write `.mdf/work/{work_id}/review-NNN.md`. Update `item.md` `latest.review` and `.mdf/index.jsonl`.
