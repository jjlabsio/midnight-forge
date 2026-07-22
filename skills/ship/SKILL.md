---
name: ship
description: "Run the pre-launch checklist via parallel fan-out to specialist personas, then synthesize a go/no-go decision"
---

# ship

Resolve the installed plugin root; an unresolved root is a stop. Load and run
the exact upstream `../using-agent-skills/SKILL.md` discovery workflow, resolve
this canonical adapter, then load the complete exact upstream
`../shipping-and-launch/SKILL.md` and every other applicable primitive selected
by discovery. Apply the installed `../../references/definition-of-done.md`,
`../../references/security-checklist.md`,
`../../references/performance-checklist.md`, and
`../../references/accessibility-checklist.md` as applicable.

## Upstream command contract

`ship` is a flat fan-out orchestrator. Against the same current release target,
run three independent specialist personas in parallel, join all three actual
reports, then let the main agent merge their evidence into one GO or NO-GO
decision with a mandatory rollback plan.

### Phase A — Parallel specialist fan-out

Before dispatch, load the plugin-installed
`../../references/subagent-dispatch-policy.md`,
`../../references/model-routing-5.6.md`, and
`../../references/model-routing-performance.md`. Resolve each exact persona
prompt from the installed plugin root and pass it unchanged with a separate
root-selected dispatch record through the generic runtime spawn path:

1. **`code-reviewer`** — apply the complete persona contract and exact upstream
   `../code-review-and-quality/SKILL.md`; review correctness, readability,
   architecture, security, and performance on the staged changes or selected
   recent commits and return the standard review report.
2. **`security-auditor`** — apply the complete persona contract and exact
   upstream `../security-and-hardening/SKILL.md`; threat-model trust boundaries,
   assess exploitable OWASP, secrets, authentication, authorization, dependency
   CVE and supply-chain risk, and return the standard security audit report.
3. **`test-engineer`** — apply the complete persona contract and exact upstream
   `../test-driven-development/SKILL.md`; assess current tests and gaps across
   happy paths, empty and boundary inputs, errors, integration, critical user
   flows, concurrency, regressions, and the verification story, then return the
   standard coverage analysis.

Dispatch all three calls concurrently in one assistant turn. They share no
mutable state or ordering dependency. Keep the topology flat: personas return
only their own report and never call each other, write project or canonical
`.mdf` state, stage, commit, accept work, advance lifecycle, push, create or
update a PR, merge, deploy, delete, mutate any external system, or perform the
final synthesis.

The root-selected GPT-5.6 record is authoritative for MDF-managed dispatch;
persona model or effort frontmatter cannot replace it. Never use a fast or
speed-only profile or silently downgrade. If the exact prompt, compatible
generic spawn path, or required capability is unavailable, use only the
explicitly permitted degraded root fallback in the normalized
`Capabilities and authority` context, or stop. Do not derive fallback
permission from the provenance mode. Sequential main-context persona
simulations are not independent parallel specialist reports.

Apply the dispatch policy's completion and join contract. Enter Phase B only
after all three calls are positively terminal and all three actual, complete
reports are available. Dispatch counts, observation lines, timeouts, partial
reports, or completion phrases do not satisfy the join. Preserve partial
reports as diagnostic evidence, but an incomplete, failed, timed-out,
interrupted, missing, stale, or degraded fan-out cannot issue a normal GO.

Skip this fan-out only when every upstream exemption condition is proven
against the complete current diff: no more than two changed files, fewer than
50 changed lines, and no authentication, payments, data access, or config/env
change. Otherwise fan-out is mandatory even when the change appears simple.
Record the exact counts, paths, and sensitive-scope assessment when the
exemption applies; an unsupported small-change claim is NO-GO.

### Phase B — Main-context evidence merge

After a complete join, or after proving the exact small-change exemption, the
main agent—not a persona or an extra summarizer agent—binds the available
specialist reports and exemption evidence to the actual release target and
evaluates six axes:

1. **Code Quality** — aggregate Critical and Important review findings with
   current unit, integration, end-to-end, build, warning, lint, typecheck,
   TODO/debug-output, and expected-error-path evidence. Resolve duplicate
   findings without losing their sources.
2. **Security** — promote Critical or High security findings to blockers and
   cross-reference the review security axis. Verify applicable secrets,
   dependency audit and supply-chain, input validation, authentication,
   authorization, security-header, rate-limit, CORS, and least-privilege
   evidence.
3. **Performance** — merge the review performance axis with applicable Core
   Web Vitals, N+1 query, image, bundle-budget, index, cache, latency, and
   capacity evidence. Do not replace measurement with an unsupported claim.
4. **Accessibility** — verify applicable keyboard and focus behavior, screen
   reader semantics, WCAG 2.1 AA contrast, form errors, and axe/Lighthouse or
   equivalent evidence directly; the three personas do not cover this axis.
5. **Infrastructure** — verify production environment variables, migrations,
   DNS and SSL, CDN, logging and error reporting, health checks, monitoring,
   and feature flags directly.
6. **Documentation** — verify applicable README/setup, API documentation,
   ADRs, changelog, and user-facing documentation directly.

For every checklist item, retain current evidence or an explicit supported
not-applicable rationale. Do not turn absence into success.

### Release, rollout, and recovery evidence

The release target also includes:

- the canonical task, approved scope, specification and plan when applicable,
  current branch/base/HEAD/tree/index, complete diff, owned paths, clean-status
  facts, current verification results, review evidence, migration notes, and
  Definition of Done mapping;
- a feature-flag plan when applicable: owner, expiry, both-state testing, flag
  initially off, internal/beta enablement, gradual 5% -> 25% -> 50% -> 100%
  rollout, monitoring at every step, and cleanup within two weeks of full
  rollout without nested flags;
- a staged rollout plan covering staging tests and smoke checks, production
  health and error checks with the flag off, internal use and a 24-hour window,
  a 5% canary with 24–48 hours of observation, gradual expansion, one-week
  full-rollout monitoring, and the ability to hold or step back;
- advance, hold, and rollback thresholds against a recorded baseline: error
  rate within 10% / 10–100% above / greater than 2x; p95 latency within 20% /
  20–50% above / greater than 50%; no new client error types / new errors under
  0.1% of sessions / above 0.1%; and neutral-or-positive business metrics /
  decline under 5% / decline above 5%;
- monitoring ownership and dashboards for application error rate, p50/p95/p99
  response time, request volume, active users and business metrics;
  infrastructure CPU, memory, database pools, disk, network and queues; and
  client Web Vitals, JavaScript errors, client-observed API errors, and load
  time as applicable;
- the named launch owner, current team notification, monitoring responsibility
  through the first-hour and staged-rollout windows, and the communication path
  for a hold or rollback;
- a rollback plan with observable triggers, exact feature-flag, version, and
  migration/data procedures as applicable, verification and communication
  steps, named ownership, and a realistic recovery time objective. Error rate
  above 2x baseline, p95 latency above 50%, an issue-report spike, data
  integrity harm, or a discovered vulnerability triggers immediate rollback;
- first-hour post-launch checks for a healthy endpoint, no new error types, no
  latency regression, a working critical user flow, flowing readable logs, and
  a verified or safely dry-run rollback mechanism.

Assessment does not perform the rollout or post-launch actions. If their
owners, thresholds, procedures, observability, or required evidence are absent,
record the gap and issue NO-GO rather than inventing readiness.

### Phase C — Root decision and rollback

The main agent produces exactly one complete result:

```markdown
## Ship Decision: GO | NO-GO

### Blockers (must fix before ship)
- [Source: Critical/High/required finding + file:line or evidence reference]

### Recommended fixes (should fix before ship)
- [Source: Important or non-blocking finding + file:line or evidence reference]

### Acknowledged risks (shipping anyway)
- [Explicitly accepted risk + mitigation + acceptance evidence]

### Rollback plan
- Trigger conditions: [observable thresholds]
- Rollback procedure: [exact steps, including data/migration handling]
- Recovery time objective: [target]

### Specialist reports (full)
- [code-reviewer report]
- [security-auditor report]
- [test-engineer report]
```

When the exact small-change exemption applies, replace the three report entries
with the recorded exemption evidence; never fabricate specialist reports.

GO requires the reviewed tree to match the approved scope; current successful
applicable tests, build, lint, typecheck, runtime and checklist evidence; the
Definition of Done; no unresolved blocking or required finding; complete
feature-flag, staged-rollout, monitoring, rollback, and post-launch plans as
applicable; and a usable rollback plan before the decision. A green command or
clean status alone is not semantic or operational proof.

The default is NO-GO for any unresolved Critical or Important code-review
finding, any Critical or High security finding, failed verification,
unresolved required check, incomplete fan-out, stale or changed evidence,
unsupported review claim, dirty or mismatched state, operational ambiguity,
missing rollback information, or unresolved disagreement. Shipping despite a
blocking risk requires explicit, current user acceptance of the named risk and
mitigation, tied to this exact release target. Never infer or reuse risk
acceptance.

## MDF/Codex adaptation

### Automatic-stage topology

When the caller supplies normalized automatic stage context, load
`../../references/auto-workflow-contract.md` and require `Stage` to select this
canonical `ship` adapter and one exact release target. Apply the context's
acceptance baseline, verification profile, continuity, read-only output
disposition, capabilities, root-observation, fan-out, synthesis, and
root-authority rules without duplicating or weakening them. The context's mode
is provenance only; a raw mode or handoff without normalized context is
malformed and finishes `BLOCKED`. Stage selection and omission remain root
composition decisions; an omitted ship stage is never invoked to create an
empty gate. The root invokes this upstream fan-out directly with `Lease and
role: root-operator`; ship does not create a generic worker lease or an
additional verifier.

This automatic ship stage is a root-owned fan-out exception: do not wrap it in
a generic `skill-backed` ship worker or let a ship worker dispatch the
specialist personas. Apply this ship-specific realization:

1. The root invokes the complete upstream three-specialist fan-out directly in
   one assistant turn and joins all three actual reports. The exact upstream
   small-change exemption remains the sole fan-out exception. When it applies,
   bind the documented exemption and let the root perform the applicable
   release assessment directly; do not represent the exemption as specialist
   reports.
2. After the required reports and root-observed release evidence are complete,
   the root alone merges the six axes, writes the rollback plan, records risk
   disposition, and issues GO or NO-GO. This is the upstream ship synthesis,
   not a generic Two-Key reconciliation or a worker-produced result.

Missing, degraded, partial, stale, changed-target, non-terminal,
under-capability, or write-capable evidence or a substantive unresolved
disagreement cannot issue a normal GO. Return that evidence to the root; only
the root selects the earliest invalidated canonical stage or finishes
`BLOCKED`. An automatic ship stage does not ask an intermediate
risk-acceptance question; missing current authority or a new material
security, data, permission, production, scope, cost, or rollback decision
finishes `BLOCKED`.

### Authority and external-action stops

Ship assessment itself is read-only. The root alone dispatches the existing
flat specialist fan-out, joins its reports, observes the release target, and
performs final synthesis. No nested ship worker may write source, project or
canonical `.mdf` state, stage, commit, accept an artifact, push, create or
update a PR, merge, deploy, delete, mutate an external system, delegate, or
perform final synthesis. The root alone owns the assessment target,
actual-state observation, acceptance, synthesis, and any later separately
authorized handoff.

A GO verdict is readiness evidence, not delivery authority. In standalone
mode, pushing, creating or updating a PR, merging, deploying, deleting a branch
or worktree, changing data, or any other external mutation is a separate
confirmation stop. Under normalized automatic context, this stage remains
read-only and cannot select or authorize delivery. A later root-owned
`github-pr` invocation requires its own normalized stage context and fresh
preflight of remote, branch, diff, authentication, mergeability, open-PR state,
and expected local/remote OIDs. Merge, deploy, branch/worktree deletion, data
deletion, force operations, and unrelated cleanup remain prohibited. Report
the ship verdict separately from any later mutation result.
