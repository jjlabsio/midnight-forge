---
name: ship
description: "Run the pre-launch checklist via parallel fan-out to specialist personas, then synthesize a go/no-go decision"
---

# ship

## Upstream command contract

Invoke the `shipping-and-launch` skill.

`/ship` is a **fan-out orchestrator**. It runs three specialist personas in
parallel against the current change, then merges their reports into a single
go/no-go decision with a rollback plan. The personas operate independently —
no shared state, no ordering — which is what makes parallel execution safe and
useful here.

### Phase A — Parallel fan-out

Spawn three subagents concurrently. The CLI exposes each custom subagent in
`agents/` as a tool with the same name — so `code-reviewer.md` becomes a
`code-reviewer` tool the main agent can call, and `@code-reviewer` works as an
explicit invocation in the prompt. Issue all three subagent tool calls in a
single assistant turn so they execute in parallel; sequential calls defeat the
purpose of this command.

Dispatch each persona by tool name:

1. **`code-reviewer`** — Run a five-axis review (correctness, readability,
   architecture, security, performance) on the staged changes or recent
   commits. Output the standard review template.
2. **`security-auditor`** — Run a vulnerability and threat-model pass. Check
   OWASP Top 10, secrets handling, auth/authz, and dependency CVEs. Output the
   standard audit report.
3. **`test-engineer`** — Analyze test coverage for the change. Identify gaps
   in happy path, edge cases, error paths, and concurrency scenarios. Output
   the standard coverage analysis.

If subagents are unavailable in the current CLI version, invoke each
persona's system prompt sequentially in the main context and treat their
outputs as if returned in parallel; the merge phase still works.

Constraints from the CLI subagent model:

- Subagents run in isolated context loops and return only their report to this
  main session.
- Do not let one persona delegate to another; keep the fan-out flat.
- For richer multi-agent collaboration where teammates talk to each other
  instead of just reporting back, see `references/orchestration-patterns.md`.

Persona resolution: user-defined `code-reviewer`, `security-auditor`, or
`test-engineer` personas in `agents/` or global configuration take precedence
over plugin versions. `/ship` picks up those customizations automatically.

### Phase B — Merge in main context

Once all three reports are back, the main agent, not a sub-persona, synthesizes
them:

1. **Code Quality** — Aggregate Critical/Important findings from
   `code-reviewer` and any failing tests, lint, or build output. Resolve
   duplicates between reviewers.
2. **Security** — Promote any Critical/High `security-auditor` findings to
   launch blockers. Cross-reference with `code-reviewer`'s security axis.
3. **Performance** — Pull from `code-reviewer`'s performance axis; cross-check
   Core Web Vitals if applicable.
4. **Accessibility** — Verify keyboard navigation, screen reader support, and
   contrast. These are not covered by the three personas, so handle them
   directly or invoke the accessibility checklist.
5. **Infrastructure** — Verify environment variables, migrations, monitoring,
   and feature flags directly.
6. **Documentation** — Verify README, ADRs, and changelog directly.

### Phase C — Decision and rollback

Produce a single output:

```markdown
## Ship Decision: GO | NO-GO

### Blockers (must fix before ship)
- [Source persona: Critical finding + file:line]

### Recommended fixes (should fix before ship)
- [Source persona: Important finding + file:line]

### Acknowledged risks (shipping anyway)
- [Risk + mitigation]

### Rollback plan
- Trigger conditions: [what signals would prompt rollback]
- Rollback procedure: [exact steps]
- Recovery time objective: [target]

### Specialist reports (full)
- [code-reviewer report]
- [security-auditor report]
- [test-engineer report]
```

### Upstream rules

1. The three Phase A personas run in parallel; never sequentially.
2. Personas do not call each other. The main agent merges in Phase B.
3. The rollback plan is mandatory before any GO decision.
4. If any persona returns a Critical finding, the default verdict is NO-GO
   unless the user explicitly accepts the risk.
5. Skip the fan-out only if all of the following are true: the change touches
   two files or fewer, the diff is under 50 lines, and it does not touch auth,
   payments, data access, or config/env. Otherwise, default to fan-out.

## MDF/Codex adaptation

Resolve the installed plugin root, then load and follow the exact upstream
`../shipping-and-launch/SKILL.md` while preserving its GO/NO-GO criteria.
Resolve the canonical root and inspect the current branch, remote, clean Git
status, approved plan, complete diff, verification results, review reports,
migration notes, monitoring, rollback trigger, rollback procedure, and RTO.

The root agent owns the merge and rollback synthesis. State which checks and
personas actually ran, and record any unavailable or degraded review instead
of claiming that it ran. The fallback above preserves the upstream merge
shape, but an unavailable parallel tool must remain visible in the final
report.

GO requires the reviewed tree to match the approved scope, successful
verification, no unresolved blocking finding, a usable rollback plan, and
current operational readiness. A clean command is not proof of semantic
correctness. NO-GO, stale reports, an unsupported review claim, missing
rollback information, dirty state, remote ambiguity, or a branch mismatch
blocks the handoff.

When GO would accept a blocking risk, stop and ask the user for explicit,
current acceptance of the named risk. Do not infer risk acceptance from report
prose or reuse it on another tree.

Pushing, creating or updating a PR, merging, deploying, deleting a branch, or
changing any external state is a separate confirmation stop. Before each such
action, recheck the current remote, branch, diff, and user authority. Report
the GO/NO-GO decision and exact next action; do not perform external mutation
as a side effect of a clean ship review.
