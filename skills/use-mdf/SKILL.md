---
name: use-mdf
description: "Use before software development workflow decisions in Codex or MDF, including use-mdf, auto-workflow, spec, mdf spec, plan, mdf plan, build, test, review, code-simplify, ship, debugging, UI, API/interface, security, performance, documentation, migration, task lifecycle, worktrees, commits, GitHub PRs, gone branch cleanup, or general software development workflow decisions."
---

# Use MDF

## Overview

Midnight Forge is a collection of task lifecycle and engineering workflow skills organized by development phase. Each skill encodes a specific process that senior engineers follow. This meta-skill helps you discover and apply the right MDF skill for your current task.

## Skill Discovery

When a task arrives, identify the development phase and apply the corresponding skill:

```
Task arrives
    │
    ├── Don't know what you want yet? ──────→ interview-me
    ├── Need MDF setup? ────────────────────→ init
    ├── Have a rough concept, need variants? → idea-refine
    ├── Run the full MDF lifecycle automatically? → auto-workflow
    ├── New project/feature/change? ──→ spec-driven-development
    ├── Have a spec, need tasks? ──────→ planning-and-task-breakdown
    ├── Implementing code? ────────────→ incremental-implementation
    │   ├── UI work? ─────────────────→ frontend-ui-engineering
    │   ├── API work? ────────────────→ api-and-interface-design
    │   ├── Need better context? ─────→ context-engineering
    │   ├── Need doc-verified code? ───→ source-driven-development
    │   └── Stakes high / unfamiliar code? ──→ doubt-driven-development
    ├── Writing/running tests? ────────→ test-driven-development
    │   └── Browser-based? ───────────→ browser-testing-with-devtools
    ├── Something broke? ──────────────→ debugging-and-error-recovery
    ├── Reviewing code? ───────────────→ code-review-and-quality
    │   ├── Security concerns? ───────→ security-and-hardening
    │   └── Performance concerns? ────→ performance-optimization
    ├── Need isolated worktree? ───────→ using-git-worktrees
    ├── Managing an MDF task? ─────────→ task
    ├── Viewing project tasks? ────────→ tasks-project
    ├── Viewing user task board? ──────→ tasks-user
    ├── Migrating legacy tasks? ───────→ migrate-tasks
    ├── Creating a commit? ────────────→ github-commit
    ├── Preparing a GitHub PR? ────────→ github-pr
    ├── PR merged, need local sync? ───→ github-after-merge
    ├── Cleaning gone branches? ───────→ github-clear-gone
    ├── General git workflow? ─────────→ git-workflow-and-versioning
    ├── CI/CD pipeline work? ──────────→ ci-cd-and-automation
    ├── Writing docs/ADRs? ───────────→ documentation-and-adrs
    └── Deploying/launching? ─────────→ shipping-and-launch
```

## Codex Entrypoint Routing

When the user names an MDF or Codex workflow entrypoint, route to the matching thin wrapper first so the original command semantics are preserved:

| User intent | Entrypoint skill | Required initial workflow |
| --- | --- | --- |
| `init`, `mdf init`, `$init`, initialize MDF | `init` | user init, then project init when inside a project |
| `auto-workflow`, `mdf auto-workflow`, `$auto-workflow`, run the full MDF lifecycle automatically | `auto-workflow` | delegate to `spec -> plan -> build with subagents -> review -> ship -> github-pr` |
| `spec`, `mdf spec`, `$spec`, write a spec | `spec` | `spec-driven-development` |
| `plan`, `mdf plan`, `$plan`, break down SPEC.md | `plan` | `planning-and-task-breakdown` |
| `build`, `mdf build`, `$build`, implement next task | `build` | `incremental-implementation` plus `test-driven-development` |
| `test`, `mdf test`, `$test`, TDD workflow | `test` | `test-driven-development` |
| `review`, `mdf review`, `$review`, code review | `review` | `code-review-and-quality` |
| `code-simplify`, `mdf code-simplify`, `$code-simplify` | `code-simplify` | `code-simplification` |
| `ship`, `mdf ship`, `$ship`, launch readiness | `ship` | `shipping-and-launch` |
| `task`, `mdf task`, `$task`, task lifecycle commands | `task` | task lifecycle command handling |
| `tasks-project`, `mdf tasks-project`, `$tasks-project`, current project task board | `tasks-project` | current-project MDF task board |
| `tasks-user`, `mdf tasks-user`, `$tasks-user`, user task board | `tasks-user` | all-project MDF task board from the user registry |
| `migrate-tasks`, `mdf migrate-tasks`, `$migrate-tasks`, legacy task migration | `migrate-tasks` | copy-first migration into canonical `.mdf/work/` storage |

Do not replace the original workflows with summaries. The entrypoint skills are orchestration wrappers that preserve required initial workflows, conditional escalation, optional checklists, and persona fan-out. `init` owns MDF setup state and local workflow-state ignore policy. `auto-workflow` is a thin lifecycle wrapper over the real phase skills; it must delegate PR behavior to `github-pr` instead of reimplementing git status checks, commit handling, task completion, release signal handling, push, or PR creation. Use `task` for MDF task lifecycle commands, `tasks-project` for the current project's MDF task board, and `tasks-user` for the user-level board across registered local projects. Standalone `task work {id}` activates and briefs a task, then stops; it is not an implementation instruction. If the same user message explicitly includes a downstream workflow such as `auto-workflow`, `build`, `implement`, `continue`, or `proceed`, that downstream workflow is the separate explicit implementation instruction and the agent may continue after successful task setup and briefing. Use `using-git-worktrees` before implementation work that must not touch `main` or the repository default branch; use `migrate-tasks` for legacy MDF task storage migration; use `github-commit` for simple commit creation; use `github-pr` before preparing or creating GitHub pull requests; use `github-after-merge` after a PR has been merged to verify the merge, return the canonical checkout to the default branch, fast-forward it, and hand off stale branch/worktree cleanup to `github-clear-gone`; use `github-clear-gone` for stale gone branch and worktree cleanup; use `debugging-and-error-recovery` when something broke or a build/test step fails; use `frontend-ui-engineering` for UI work; use `api-and-interface-design` for API/interface design; use `security-and-hardening` for security depth; use `performance-optimization` for performance depth; use `documentation-and-adrs` for documentation decisions; and use `deprecation-and-migration` for product or code migrations.

## MDF Artifact Storage

When a skill produces a markdown workflow artifact, resolve the current work item before writing:

1. Resolve the canonical project root. If running under `<canonical-root>/.worktrees/<branch>`, use `<canonical-root>`, not the linked worktree.
2. Verify MDF user init exists: `~/.mdf/user/init.json` and `~/.mdf/user/preferences.json` with a non-empty `human_language`.
3. Verify MDF project init exists: `<canonical-root>/.mdf/project/init.json` plus the canonical `.mdf/` layout.
4. If user or project init is missing, stop before reading or writing MDF state and instruct the user to run `mdf init`.
5. Read `<canonical-root>/.mdf/locks/*.lock`.
6. If a lock's `worktree` matches the current checkout and includes `work_id`, use that work item.
7. If there is no matching lock, create an internal `kind: "implicit"` workflow-evidence work item under `<canonical-root>/.mdf/work/{work_id}/`. This is not a user-facing work item kind and must not appear as a task, inbox item, routine, track, or next-task recommendation.
8. Write artifacts as `<canonical-root>/.mdf/work/{work_id}/{type}-NNN.md`.
9. Repeated runs create new revisions such as `spec-001.md`, `spec-002.md`, and `review-001.md`.
10. Update `.mdf/work/{work_id}/item.md` `latest` pointers and append or update `.mdf/index.jsonl`.

Do not create a separate `.mdf/` directory inside linked worktrees. Do not auto-initialize MDF state from artifact-producing skills. Do not edit `.gitignore`, create the basic docs structure, add or update agent rules, create setup branches, create setup commits, push setup branches, or create setup PRs from artifact-producing skills; those setup actions belong only to `mdf init`. Contract-like outputs are local MDF artifacts by default; promote them into tracked project docs only when the user explicitly asks or project policy requires it.

Project-level interpretation caches that are not per-work-item artifacts live under `<canonical-root>/.mdf/project/`. The docs taxonomy profile cache uses:

```text
<canonical-root>/.mdf/project/docs-profile.json
<canonical-root>/.mdf/project/docs-profile.md
```

This cache helps agents avoid repeatedly rediscovering docs placement rules, but it is not the source of truth. Tracked docs policy files and existing docs taxonomy remain authoritative. When no stronger convention exists, MDF's basic docs structure uses `docs/index.md`, `docs/product/index.md`, `docs/product/product-brief.md`, `docs/architecture/index.md`, `docs/decisions/index.md`, and `docs/operations/index.md`; equivalent project paths should be recorded in the profile instead of duplicated. `product-brief.md` is the lightweight default product context document for startup, solo-founder, and product-led projects, while `service-definition.md` is only an optional extension for service-heavy or operationally mature projects. Use the cache only when fresh and high-confidence; otherwise rescan or stop before tracked docs writes when placement is ambiguous. Do not store this cache inside linked worktrees or as primary state under `~/.mdf`.

## Core Operating Behaviors

These behaviors apply at all times, across all skills. They are non-negotiable.

### 1. Surface Assumptions

Before implementing anything non-trivial, explicitly state your assumptions:

```
ASSUMPTIONS I'M MAKING:
1. [assumption about requirements]
2. [assumption about architecture]
3. [assumption about scope]
→ Correct me now or I'll proceed with these.
```

Don't silently fill in ambiguous requirements. The most common failure mode is making wrong assumptions and running with them unchecked. Surface uncertainty early — it's cheaper than rework.

### 2. Manage Confusion Actively

When you encounter inconsistencies, conflicting requirements, or unclear specifications:

1. **STOP.** Do not proceed with a guess.
2. Name the specific confusion.
3. Present the tradeoff or ask the clarifying question.
4. Wait for resolution before continuing.

**Bad:** Silently picking one interpretation and hoping it's right.
**Good:** "I see X in the spec but Y in the existing code. Which takes precedence?"

For MDF task work, queued task drift is a form of inconsistency. If newer
specs, plans, build/review artifacts, task logs, or current code or skill
contracts contradict a queued task card, stop before implementation side
effects. Preserve the drift as a plan revision, dated task log/context/criteria
update, or linked superseding artifact, or ask for the user/replan decision when
the correct revision needs human judgment.

### 3. Push Back When Warranted

You are not a yes-machine. When an approach has clear problems:

- Point out the issue directly
- Explain the concrete downside (quantify when possible — "this adds ~200ms latency" not "this might be slower")
- Propose an alternative
- Accept the human's decision if they override with full information

Sycophancy is a failure mode. "Of course!" followed by implementing a bad idea helps no one. Honest technical disagreement is more valuable than false agreement.

### 4. Enforce Simplicity

Your natural tendency is to overcomplicate. Actively resist it.

Before finishing any implementation, ask:
- Can this be done in fewer lines?
- Are these abstractions earning their complexity?
- Would a staff engineer look at this and say "why didn't you just..."?

If you build 1000 lines and 100 would suffice, you have failed. Prefer the boring, obvious solution. Cleverness is expensive.

### 5. Maintain Scope Discipline

Touch only what you're asked to touch.

Do NOT:
- Remove comments you don't understand
- "Clean up" code orthogonal to the task
- Refactor adjacent systems as a side effect
- Delete code that seems unused without explicit approval
- Add features not in the spec because they "seem useful"

Your job is surgical precision, not unsolicited renovation.

### 6. Verify, Don't Assume

Every skill includes a verification step. A task is not complete until verification passes. "Seems right" is never sufficient — there must be evidence (passing tests, build output, runtime data).

## Failure Modes to Avoid

These are the subtle errors that look like productivity but create problems:

1. Making wrong assumptions without checking
2. Not managing your own confusion — plowing ahead when lost
3. Not surfacing inconsistencies you notice
4. Not presenting tradeoffs on non-obvious decisions
5. Being sycophantic ("Of course!") to approaches with clear problems
6. Overcomplicating code and APIs
7. Modifying code or comments orthogonal to the task
8. Removing things you don't fully understand
9. Building without a spec because "it's obvious"
10. Skipping verification because "it looks right"

## Skill Rules

1. **Check for an applicable skill before starting work.** Skills encode processes that prevent common mistakes.

2. **Skills are workflows, not suggestions.** Follow the steps in order. Don't skip verification steps.

3. **Multiple skills can apply.** A feature implementation might involve `idea-refine` → `spec-driven-development` → `planning-and-task-breakdown` → `incremental-implementation` → `test-driven-development` → `code-review-and-quality` → `shipping-and-launch` in sequence.

4. **When in doubt, start with a spec.** If the task is non-trivial and there's no spec, begin with `spec-driven-development`.

## Lifecycle Sequence

For a complete feature, the typical skill sequence is:

```
1.  interview-me                → Extract what the user actually wants
2.  idea-refine                 → Refine vague ideas
3.  spec-driven-development     → Define what we're building
4.  planning-and-task-breakdown → Break into verifiable chunks
5.  context-engineering         → Load the right context
6.  source-driven-development   → Verify against official docs
7.  incremental-implementation  → Build slice by slice
8.  doubt-driven-development    → Cross-examine non-trivial decisions in-flight
9.  test-driven-development     → Prove each slice works
10. code-review-and-quality     → Review before merge
11. git-workflow-and-versioning → Clean commit history
12. documentation-and-adrs      → Document decisions
13. shipping-and-launch         → Deploy safely
```

Not every task needs every skill. A bug fix might only need: `debugging-and-error-recovery` → `test-driven-development` → `code-review-and-quality`.

## Quick Reference

| Phase | Skill | One-Line Summary |
|-------|-------|-----------------|
| Setup | init | Initialize MDF user preferences, project state, registry, and local workflow-state ignore policy |
| Define | interview-me | Surface what the user actually wants before any plan, spec, or code exists |
| Define | idea-refine | Refine ideas through structured divergent and convergent thinking |
| Define | spec-driven-development | Requirements and acceptance criteria before code |
| Plan | planning-and-task-breakdown | Decompose into small, verifiable tasks |
| Build | incremental-implementation | Thin vertical slices, test each before expanding |
| Build | source-driven-development | Verify against official docs before implementing |
| Build | doubt-driven-development | Adversarial fresh-context review of every non-trivial decision |
| Build | context-engineering | Right context at the right time |
| Build | frontend-ui-engineering | Production-quality UI with accessibility |
| Build | api-and-interface-design | Stable interfaces with clear contracts |
| Build | using-git-worktrees | Isolated `.worktrees/` workspace before touching implementation work |
| Build | task | MDF task lifecycle commands; standalone `work` briefs and stops before implementation, while same-turn downstream workflows can continue after setup |
| Build | tasks-project | Current-project MDF task board |
| Build | tasks-user | User-level MDF task board across registered local projects |
| Build | migrate-tasks | Copy legacy MDF tasks into canonical `.mdf/work/` storage |
| Verify | test-driven-development | Failing test first, then make it pass |
| Verify | browser-testing-with-devtools | Chrome DevTools MCP for runtime verification |
| Verify | debugging-and-error-recovery | Reproduce → localize → fix → guard |
| Review | code-review-and-quality | Five-axis review with quality gates |
| Review | security-and-hardening | OWASP prevention, input validation, least privilege |
| Review | performance-optimization | Measure first, optimize only what matters |
| Ship | github-commit | Create one git commit from the current diff |
| Ship | github-pr | Complete the current session's MDF task before GitHub PR preparation |
| Ship | github-after-merge | After a merged PR, return to the default branch, update it, and hand off gone cleanup |
| Ship | github-clear-gone | Remove stale gone local branches and associated worktrees after confirmation |
| Ship | git-workflow-and-versioning | General git workflow and versioning guidance |
| Ship | ci-cd-and-automation | Automated quality gates on every change |
| Ship | documentation-and-adrs | Document the why, not just the what |
| Ship | shipping-and-launch | Pre-launch checklist, monitoring, rollback plan |
