---
name: review
description: "Conduct a five-axis code review — correctness, readability, architecture, security, performance"
---

# review

## Upstream command contract

Invoke the `code-review-and-quality` skill and review the current changes
(staged or recent commits) across all five axes:

1. **Correctness** — Does it match the spec? Edge cases handled? Tests
   adequate?
2. **Readability** — Clear names? Straightforward logic? Well-organized?
3. **Architecture** — Follows existing patterns? Clean boundaries? Right
   abstraction level?
4. **Security** — Input validated? Secrets safe? Auth checked? Use the
   `security-and-hardening` skill.
5. **Performance** — No N+1 queries? No unbounded operations? Use the
   `performance-optimization` skill.

Categorize findings as `Critical`, `Important`, or `Suggestion`. Output a
structured review with specific `file:line` references and fix
recommendations.

Resolve the installed plugin root, then load and follow the exact upstream
`../code-review-and-quality/SKILL.md` without adding or weakening its
criteria. Resolve the canonical root, then
read the exact specification, plan, task card, current diff, tests, and
verification notes that are relevant to the requested review.

## Review modes

The review-specific resolver is a model inspection step; writes still require
the strict active-lock resolver and current task ownership.

- `lifecycle-review` covers the approved specification and plan, the complete
  task sequence, whole-build checks, simplification result, and the clean
  final tree.
- `task-review` covers the task card, exact Git diff, owned paths, successful
  focused verification, and any downstream-impact note. It is read-only and
  must not recreate a task lock, mutate a card, or promote itself to ship. It
  cannot create lifecycle evidence; it only reports on the supplied tree.

The `review_mode` is a readable label for the selected review scope, not a
permission to mutate workflow state. A completed task can be reviewed
read-only after its lock is released.

Standalone `review` is one pass. Save a human-readable `review-NNN.md` report
under the canonical work item and stop. A review report is not user approval,
does not change task state, and cannot authorize an external action by itself.
When independent freshness is required, ask for a fresh upstream reviewer;
otherwise perform a root review and disclose that limitation rather than
claiming an unavailable reviewer ran.

## Review method

Check correctness, readability, architecture, security, and performance. Use
the full relevant source context and verification output, not only a summary or
headings. Use the upstream command's `Critical`, `Important`, and `Suggestion`
categories, and classify the substance of each finding as an actionable defect,
clarity suggestion, scope/plan change, or user decision. Fix actionable
findings and rerun the appropriate verification and review while material
progress continues. Stop for repeated findings, regressions, ambiguity, or a
material trade-off.

The security and performance skill references are same-context skill loads;
they do not add subagent fan-out unless the user explicitly requests it.

Only the root agent writes the report. Keep the report readable, cite paths and
commands, and state the final disposition and remaining risk. A passing review
means the reviewed tree satisfies the supplied contract; it is not proof that
the command output alone establishes semantic correctness.
