---
name: ship
description: "Run the pre-launch checklist via parallel fan-out to specialist personas, then synthesize a go/no-go decision"
---

# ship

When called with `mode: auto-workflow` or `mode: auto-workflow-pr`, load
`../../references/auto-workflow-contract.md`. Local `auto-workflow` mode does
not invoke ship. In `auto-workflow-pr` mode, a GO decision may continue to push
and create/update its PR, subject to the final preflight; it may not merge,
deploy, or delete anything.

The `mode` string is not authority by itself. Require the current run handoff,
matching task/lock/worktree/branch facts, approved artifact hashes, and the
PR-mode final preflight before treating a GO result as delivery authority.

## Upstream command contract

Invoke the `shipping-and-launch` skill.

`/ship` is a **fan-out orchestrator**. It runs three specialist personas in
parallel against the current change, then merges their reports into a single
go/no-go decision with a rollback plan. The personas operate independently —
no shared state, no ordering — which is what makes parallel execution safe and
useful here.

### Phase A — Parallel fan-out

Before issuing any of the three calls, the root loads the plugin-installed
`../../references/subagent-dispatch-policy.md` and
`../../references/model-routing-5.6.md`. Classify the release difficulty and
risk once, verify GPT-5.6 capability, and select a separate dispatch record for
each persona through the generic runtime spawn path. Pass the exact persona
prompt plus that record; persona model or effort frontmatter is only a
direct-invocation default and the root-selected record is authoritative here.
If capability is missing, use the root fallback with `degraded: true` or stop
the gate explicitly. Never silently downgrade, select a fast profile, or let a
persona write the ship decision.

Spawn three subagents concurrently. If the platform's named-persona tool can
accept the root-selected dispatch record, it may be used. Otherwise use the
generic runtime spawn path with the exact persona prompt and dispatch record.
Do not rely on persona model or effort frontmatter for an MDF-managed call.
Issue all three subagent calls in a single assistant turn so they execute in
parallel; sequential calls defeat the purpose of this command.

Dispatch each persona role through the selected compatible path:

1. **`code-reviewer`** — Run a five-axis review (correctness, readability,
   architecture, security, performance) on the staged changes or recent
   commits. Output the standard review template.
2. **`security-auditor`** — Run a vulnerability and threat-model pass. Check
   OWASP Top 10, secrets handling, auth/authz, and dependency CVEs. Output the
   standard audit report.
3. **`test-engineer`** — Analyze test coverage for the change. Identify gaps
   in happy path, edge cases, error paths, and concurrency scenarios. Output
   the standard coverage analysis.

If no compatible named-persona or generic spawn path is available, use the root
fallback with `degraded: true` or stop the gate explicitly. Do not present
sequential main-context persona prompts as independent subagent reports.

Constraints from the CLI subagent model:

- Subagents run in isolated context loops and return only their report to this
  main session.
- Do not let one persona delegate to another; keep the fan-out flat.
- For richer multi-agent collaboration where teammates talk to each other
  instead of just reporting back, see `references/orchestration-patterns.md`.

Persona resolution: user-defined `code-reviewer`, `security-auditor`, or
`test-engineer` personas in `agents/` or global configuration may customize the
persona prompt and perspective. Their model and effort settings are defaults
for direct invocation only; the root-selected dispatch record takes precedence
for MDF-managed `/ship` calls.

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

In standalone mode, pushing, creating or updating a PR, merging, deploying,
deleting a branch, or changing any external state is a separate confirmation
stop. In `mode: auto-workflow-pr`, the initial invocation authorizes only push
and PR create/update. Before those actions, recheck the current remote, branch,
diff, authentication, mergeability, and open-PR state. Merge, deploy, branch
or worktree deletion, and data deletion remain prohibited. Report the GO/NO-GO
decision and exact mutation result; never treat a clean ship review as
authority for a prohibited action. Local `auto-workflow` mode has no external
mutation authority and must not invoke this handoff.
