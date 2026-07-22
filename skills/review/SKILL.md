---
name: review
description: "Conduct a five-axis code review — correctness, readability, architecture, security, performance"
---

# review

## Upstream command contract

Invoke the code-review-and-quality skill.

Review the current changes (staged or recent commits) across all five axes:

1. **Correctness** — Does it match the spec? Edge cases handled? Tests adequate?
2. **Readability** — Clear names? Straightforward logic? Well-organized?
3. **Architecture** — Follows existing patterns? Clean boundaries? Right abstraction level?
4. **Security** — Input validated? Secrets safe? Auth checked? (Use security-and-hardening skill)
5. **Performance** — No N+1 queries? No unbounded ops? (Use performance-optimization skill)

Categorize findings as Critical, Important, or Suggestion.
Output a structured review with specific file:line references and fix recommendations.

## MDF adaptation

1. Resolve the installed plugin and canonical project roots.
2. Run exact upstream `using-agent-skills` discovery. Load this adapter and
   every applicable primitive it selects.
3. Bind the report to an explicit target: staged diff, commit range, or full
   approved tree; include its base and HEAD.
4. Keep the review read-only. Save a requested report as the next immutable
   `.mdf/work/<work-id>/review-NNN.md` without changing task lifecycle.
5. Return the structured findings and verification gaps. The caller decides
   acceptance, repair, commit, and what runs next.
