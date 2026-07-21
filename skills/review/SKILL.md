---
name: review
description: "Conduct a five-axis code review — correctness, readability, architecture, security, performance"
---

# review

Resolve the installed plugin root; an unresolved root is a stop. Load and run
the exact upstream `../using-agent-skills/SKILL.md` discovery workflow, resolve
this canonical adapter, then load the exact upstream
`../code-review-and-quality/SKILL.md` and every other applicable primitive
selected by discovery. Load the exact upstream
`../security-and-hardening/SKILL.md` and
`../performance-optimization/SKILL.md` for the command's security and
performance lenses; apply their detailed workflows when their triggers apply,
including threat-boundary analysis and measurement before optimization.

## Upstream command contract

Review the current changes, whether staged or in the selected recent commits,
across all five axes:

1. **Correctness** — match the acceptance contract; inspect edge, error, race,
   and state paths; decide whether tests prove the intended behavior.
2. **Readability** — require clear names, straightforward flow, cohesive
   organization, earned abstractions, and no avoidable complexity.
3. **Architecture** — preserve boundaries, dependency direction, existing
   patterns, explicit types, and the owning layer; reject complexity merely
   relocated behind another abstraction.
4. **Security** — treat external and model-produced data as untrusted; assess
   validation, secrets, authentication, authorization, injection, output
   encoding, dependency provenance, and least privilege as applicable.
5. **Performance** — assess N+1 work, unbounded operations, synchronous hot
   paths, unnecessary rendering or allocation, pagination, and measured
   regressions without inventing premature optimizations.

Use the complete upstream process:

1. Understand the change's intent, expected behavior, and acceptance context.
2. Read the tests first; assess behavioral coverage, edge cases, names, and
   whether a regression would fail them.
3. Inspect every changed implementation path across all five axes and relevant
   surrounding context.
4. Propose a concrete structural remedy for structural findings. Prefer
   collapsing branches, separating orchestration from owned logic, moving
   feature logic to its owner, reusing the canonical helper, making a type
   boundary explicit, deleting pass-through indirection, or extracting a
   focused module.
5. Assess change and resulting-file size: roughly 100 changed lines is readily
   reviewable, roughly 300 is acceptable for one logical change, and roughly
   1000 should normally be split; a resulting file near 1000 total lines is an
   inspection signal, not a hard cap. Check that refactoring is separated from
   behavior and that the change description is imperative, standalone, and
   explains what and why.
6. Review dependency additions or upgrades, the complete lockfile impact,
   maintenance, provenance, license, advisories, changelog or migration notes,
   isolation, and before/after test evidence. Prefer the standard library and
   existing utilities.
7. Identify orphaned or unreachable code explicitly; do not delete uncertain
   dead code without evidence. Verify the verification story: exact tests,
   build, applicable manual/runtime evidence, and before/after evidence.

Report findings in leverage order with exact `file:line` evidence, impact, and
an actionable fix recommendation. Mark each as an actionable defect, clarity
suggestion, scope or plan change, or user decision. Use MDF's command categories
without weakening the loaded skill's severities:

- `Critical`: upstream Critical blockers, including vulnerabilities, data loss,
  or broken behavior.
- `Important`: every upstream required/no-prefix actionable change. These must
  be resolved before review `PASS`; never demote one to a suggestion.
- `Suggestion`: upstream Optional, Consider, Nit, or FYI feedback; retain
  whether it is optional, minor, or informational.

Be direct and evidence-led. Do not rubber-stamp, soften defects, accept
"later" cleanup, infer quality from green tests alone, or turn personal style
preferences into blockers. Return `PASS` when the change demonstrably improves
overall code health and all Critical and required findings are resolved; do
not require personal perfection.

## MDF/Codex adaptation

Resolve the canonical project root and exact review target before assessing it:

- `lifecycle-review` covers the current specification and plan, complete task
  sequence, whole-build verification, simplification result, complete delegated
  tree, and final cleanliness.
- `task-review` covers the task card, exact staged or selected Git diff, owned
  paths, focused verification, and downstream-impact note. It is read-only and
  cannot recreate a lock, mutate a card, or create lifecycle evidence.
- `mode: quick-workflow-pr` uses the current request, active task Context,
  quick handoff, exact bounded-change diff, and verification evidence as its
  acceptance baseline. Do not require or create a specification or plan.

The scope label grants no mutation authority. A completed task may be reviewed
read-only after lock release.

### Automatic-mode independent assessments

For `mode: auto-workflow`, `mode: auto-workflow-pr`, or
`mode: quick-workflow-pr`, load
`../../references/auto-workflow-contract.md` and apply its mandatory read-only
Two-Key stage lease. Also load
`../../references/subagent-dispatch-policy.md`,
`../../references/model-routing-5.6.md`, and
`../../references/model-routing-performance.md`.
Use their shared dispatch, evidence, quality-floor, terminality, recovery, and
root-authority mechanics without restating or weakening them. A bare mode
string is not authority.

1. The root observes and binds one canonical target bundle: the actual
   canonical diff or artifact, original acceptance context for the selected
   scope, complete verification evidence, and current canonical and Git state.
2. Dispatch two distinct fresh-context independent primary assessors of that
   same bundle. Each runs exact discovery and this complete review contract.
   Both are read-only and non-delegating; neither receives, reviews, summarizes,
   or validates the other's report. Do not form a producer plus review-of-report
   chain or let a specialist lens substitute for either complete five-axis
   assessment.
3. Run them in parallel only when they are genuinely independent. If execution
   must be serial, re-observe that the target is byte-for-byte and state-for-
   state unchanged before the second assessor; both still bind to the identical
   target.
4. Neither assessor may write source or canonical reports; mutate `.mdf`; stage
   or commit; accept work; advance lifecycle; mutate external state; delegate;
   repair a finding; or perform final synthesis.
5. The root confirms both actual assessments returned terminally and the target
   remained unchanged, then independently reconciles their findings and exact
   evidence into `PASS`, `REWORK`, or `BLOCKED`. Only the root writes the
   canonical report or synthesis.

`PASS` requires current successful verification and no Critical or Important
actionable finding. A disagreement requiring unresolved technical or user
judgment cannot advance. An actionable finding returns through the shared
recovery contract to the earliest owning implementation stage; review never
repairs itself. Missing, incomplete, stale, non-terminal, under-capability, or
non-independent assessment; changed target; scope violation; unresolved
disagreement; or exhausted three-cycle recovery finishes `BLOCKED`.

### Standalone report and stop

Standalone `review` performs one pass in the current context. Save one readable
`review-NNN.md` under the canonical work item with the target and acceptance
context, verification assessment, ordered categorized findings, exact evidence,
fix recommendations, disposition, and remaining risk, then stop. Only the root
writes that report. Do not repair code, stage, commit, mutate task or lock state,
advance lifecycle, or perform an external action. The report is evidence, not
authority or proof that its own conclusion is correct. When independent
freshness is requested but unavailable, disclose the limitation rather than
claiming another reviewer ran.
