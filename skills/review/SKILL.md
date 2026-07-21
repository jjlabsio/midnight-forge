---
name: review
description: "Conduct a five-axis code review — correctness, readability, architecture, security, performance"
---

# review

When called with `mode: auto-workflow` or `mode: auto-workflow-pr`, load
`../../references/auto-workflow-contract.md` and apply its bounded delegation,
root-synthesis, and auto-authority rules.
When called with `mode: quick-workflow-pr`, load the same contract and use the
current user request, active task Context, exact diff, and verification
evidence as the acceptance baseline. Do not require or create a spec or plan.
Keep the complete five-axis review and finding categories unchanged.

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
criteria. Resolve the canonical root, then read the exact specification, plan,
task card, current diff, tests, and verification notes that are relevant to
the requested review. In `mode: quick-workflow-pr`, replace the absent
specification and plan with the current quick handoff and task Context; do not
invent substitute artifacts.

When an independent reviewer is delegated, the root must first load the
plugin-installed `../../references/subagent-dispatch-policy.md` and
`../../references/model-routing-5.6.md`. Classify review difficulty and risk,
verify GPT-5.6 capability at the `high` floor, and pass the root-selected
dispatch record with one resolved instruction source through the generic runtime
spawn path. Automatic review assessors are `skill-backed` and assess the exact
canonical review target without a persona. An explicitly named specialist
reviewer remains `persona-backed` and requires its exact installed prompt.
Persona model or effort frontmatter is only a direct-invocation default; the
root-selected dispatch record overrides it for MDF-managed work. If capability
or instruction source is unavailable, use a visible degraded root fallback or
stop; never silently use a fast, older, or future profile.

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

The security and performance skill references are same-context skill loads in a
standalone review. In `mode: auto-workflow` or `mode: auto-workflow-pr`, the
user has authorized bounded
lifecycle delegation, so the root may fan out independent code, security, and
test review reports in parallel, then synthesize them in the root context.
Reviewers remain report-only; they do not mutate canonical state or authorize
ship/PR actions.

Only the root agent writes the report. Keep the report readable, cite paths and
commands, and state the final disposition and remaining risk. A passing review
means the reviewed tree satisfies the supplied contract; it is not proof that
the command output alone establishes semantic correctness.
