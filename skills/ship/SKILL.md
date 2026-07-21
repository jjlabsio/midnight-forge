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
dispatch policy's visible degraded root fallback where the current mode permits
it, or stop. Sequential main-context persona simulations are not independent
parallel specialist reports.

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

- the canonical task, delegated scope, specification and plan when applicable,
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
- [Risk disposition + mitigation + current evidence; unresolved blockers remain
  NO-GO]

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

GO requires the reviewed tree to match the delegated scope; current successful
applicable tests, build, lint, typecheck, runtime and checklist evidence; the
Definition of Done; no unresolved blocking or required finding; complete
feature-flag, staged-rollout, monitoring, rollback, and post-launch plans as
applicable; and a usable rollback plan before the decision. A green command or
clean status alone is not semantic or operational proof.

The default is NO-GO for any unresolved Critical or Important code-review
finding, any Critical or High security finding, failed verification,
unresolved required check, incomplete fan-out, stale or changed evidence,
unsupported review claim, dirty or mismatched state, operational ambiguity,
missing rollback information, or unresolved disagreement. A blocking risk
cannot be waived by a user-approval prompt: keep the result NO-GO, record the
named risk and missing mitigation, and finish `BLOCKED` when the workflow must
continue no further. Never infer or reuse risk acceptance.

## MDF/Codex adaptation

### Automatic-mode topology

`mode: auto-workflow` and `mode: quick-workflow-pr` omit ship by authority and
must not create an empty ship gate. Only `mode: auto-workflow-pr` invokes this
automatic stage. A mode string alone is not authority: require the current run
handoff and matching task, lock, worktree, branch, exact artifact integrity
hashes, and actual Git state.

In `mode: auto-workflow-pr`, load
`../../references/auto-workflow-contract.md` and apply its complete mandatory
Two-Key lease, dispatch, evidence, quality-floor, positive-terminality,
three-cycle recovery, and root-authority rules without duplicating or weakening
them. This automatic ship stage is a root-owned fan-out exception: do not wrap
it in a generic `skill-backed` ship worker or let a ship worker dispatch the
specialist personas. Apply this ship-specific realization:

1. The root-owned complete upstream three-specialist fan-out is the primary
   assessment key. Its result is the three full joined reports plus the
   root-observed release evidence above—not another generic assessor or
   summarizer. The exact
   upstream small-change exemption remains the sole fan-out exception. When it
   applies, bind the documented exemption and dispatch one distinct
   fresh-context, read-only, nondelegating primary assessor to apply this
   complete contract to the same release target; this exception cannot be used
   when any exemption condition is absent or uncertain.
2. Only after the primary key is positively terminal—every required specialist
   and report for normal fan-out, or the exempt primary assessor and its actual
   result—may the root independently observe the actual reports or result,
   release target, canonical and Git state, and command evidence, then dispatch
   one distinct fresh-context verifier. Give it the original ship contract and
   the same actual assembled release target; exclude primary-key reasoning and
   any draft or final synthesis report.
3. The verifier independently applies this complete ship contract read-only
   and nondelegating. It cannot review a synthesis report, replace or repeat
   the primary fan-out, call personas, fan out, write project or `.mdf` state,
   stage, commit, accept work, advance lifecycle, mutate external state, write
   the rollback plan, or issue the final GO/NO-GO synthesis.
4. The root verifies both keys remain bound to an unchanged release target and
   alone reconciles their evidence and disagreements into `PASS`, `REWORK`, or
   `BLOCKED`; merges the six axes; writes the rollback plan; records risk
   disposition; and issues GO or NO-GO. GO corresponds to a Two-Key `PASS`.

Missing, degraded, partial, stale, changed-target, non-terminal,
under-capability, non-independent, or write-capable evidence or a substantive
unresolved disagreement cannot advance. Re-enter the earliest invalidated
canonical build, test, review, or ship gate under the shared recovery contract,
or finish `BLOCKED` within its three-cycle limit. Automatic mode does not ask
an intermediate risk-acceptance question; missing current authority or a new
material security, data, permission, production, scope, cost, or rollback
decision finishes `BLOCKED`.

### Authority and external-action stops

Ship assessment itself is read-only. The root alone dispatches the existing
flat specialist fan-out, joins its reports, observes the release target, and
dispatches the independent verifier. No nested ship worker may write source,
project or canonical `.mdf` state, stage, commit, accept an artifact, push,
create or update a PR, merge, deploy, delete, mutate an external system,
delegate, or perform final synthesis. The root alone owns the assessment
target, actual-state observation, acceptance, synthesis, and any later
separately authorized handoff.

A GO verdict is readiness evidence, not delivery authority. Any external
mutation must be explicitly named by the current autonomous execution envelope
and revalidated by its consuming skill; an action outside that envelope is a
`BLOCKED` stop, not a confirmation prompt. In `mode: auto-workflow-pr`, the
initial invocation may authorize only a later root-owned push and PR
create/update through the canonical `github-pr` skill after a fresh preflight
of remote, branch, diff, authentication, mergeability, open-PR state, and
expected local/remote OIDs.
Merge, deploy, branch/worktree deletion, data deletion, force operations, and
unrelated cleanup remain prohibited. Report the ship verdict separately from
any later mutation result.
