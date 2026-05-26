# Implementation Plan: MDF Work Artifact Storage

## Overview

Implement the new MDF artifact storage model as markdown skill instructions. The change moves artifact guidance toward a canonical project-root `.mdf/work/{work_id}/` model, keeps `.mdf/` out of linked worktrees, extends locks with enough context to resolve the current work item, and updates artifact-producing skills to use revisioned files under the current work item.

No executable runtime, CLI helper, MCP server, or migration script is required for this plan. The work is instruction-only and should remain easy to review.

## Architecture Decisions

- Use the canonical project root as the only authoritative `.mdf/` location. Worktrees are code checkouts, not independent MDF stores.
- Introduce `work_id` as the stable workflow context. A work item may be task-backed or implicit.
- Store artifact files under `.mdf/work/{work_id}/` with `{type}-NNN.md` revisions.
- Keep global discovery separate from artifact storage. `~/.mdf/projects.json` points to canonical project roots; project-local `.mdf/index.jsonl` indexes work and artifacts.
- Preserve the current LLM-driven skill architecture. Instructions change; no new command runner is added.

## Dependency Graph

```text
Storage terminology and invariants
  -> task skill storage, work item, lock shape
      -> using-git-worktrees caller/canonical-root guidance
          -> tasks skill board and cross-project discovery guidance
              -> artifact-producing entrypoint skills
                  -> validation and manual scenario review
```

The `task` skill is the foundation because it creates work items and locks. Entry point skills such as `spec`, `plan`, `build`, `review`, and `ship` depend on those rules to resolve where artifacts belong.

## Task List

### Phase 1: Storage Foundation

## Task 1: Define canonical `.mdf` storage in task lifecycle

**Description:** Update `skills/task/SKILL.md` so the task lifecycle uses canonical project-root `.mdf/` storage, creates `work_id`-backed work items, writes item cards under `.mdf/work/{work_id}/item.md`, and writes locks under `.mdf/locks/{task_id}.lock` with `canonical_root`, `worktree`, `branch`, and `work_id`.

**Acceptance criteria:**
- [ ] `task` no longer describes authoritative task state as only `~/.mdf/projects/{project-hash}/`.
- [ ] The skill defines canonical root `.mdf/project.json`, `.mdf/index.jsonl`, `.mdf/work/`, and `.mdf/locks/`.
- [ ] `add` creates a work item card and updates local index metadata.
- [ ] `work` creates or reuses a work item and writes a lock with `canonical_root` and `work_id`.
- [ ] `done` updates `item.md` and removes the matching lock.

**Verification:**
- [ ] `node scripts/validate-agent-skills-port.js`
- [ ] Manual read-through confirms `task work` can resolve a work item from a normal checkout and from a linked worktree.

**Dependencies:** None

**Files likely touched:**
- `skills/task/SKILL.md`

**Estimated scope:** Medium: 1 file

## Task 2: Document canonical-root behavior in worktree setup

**Description:** Update `skills/using-git-worktrees/SKILL.md` to state that linked worktrees must not create their own `.mdf/` storage and that caller workflows should write MDF artifacts to the canonical project root recorded in the task lock.

**Acceptance criteria:**
- [ ] The skill explicitly says `.mdf/` is not copied into worktrees and should not be created there.
- [ ] The report/caller responsibility section names `canonical_root`.
- [ ] The skill still only creates `.worktrees/<branch-name>` and does not take over task lock behavior.

**Verification:**
- [ ] `node scripts/validate-agent-skills-port.js`
- [ ] Manual scenario: worktree creation guidance does not conflict with `task` lock ownership.

**Dependencies:** Task 1

**Files likely touched:**
- `skills/using-git-worktrees/SKILL.md`

**Estimated scope:** Small: 1 file

### Checkpoint: Storage Foundation

- [ ] `task` and `using-git-worktrees` agree on canonical root and worktree responsibilities.
- [ ] No instructions create `.mdf/` inside a linked worktree.
- [ ] Validation script passes.

### Phase 2: Discovery and Current Work Resolution

## Task 3: Update tasks board and cross-project discovery

**Description:** Update `skills/tasks/SKILL.md` so project boards read project-local `.mdf/index.jsonl`, `.mdf/work/*/item.md`, and `.mdf/locks/*.lock`, while `tasks all` uses `~/.mdf/projects.json` as the registry of canonical project roots.

**Acceptance criteria:**
- [ ] The storage section defines `.mdf/` project-local board state.
- [ ] `tasks all` reads `~/.mdf/projects.json`, not only `~/.mdf/projects/*/meta.json`.
- [ ] Board rendering uses work item status from `item.md` plus locks.
- [ ] Cleanup/stale behavior is framed around work item expiration/completion dates without deleting active locked work.

**Verification:**
- [ ] `node scripts/validate-agent-skills-port.js`
- [ ] Manual scenario: a global board can find multiple projects from the registry and read their local indexes.

**Dependencies:** Task 1

**Files likely touched:**
- `skills/tasks/SKILL.md`

**Estimated scope:** Medium: 1 file

## Task 4: Add shared artifact resolution rules to workflow entrypoints

**Description:** Update top-level orchestration guidance so artifact-producing skills first resolve the current work item from active locks and only create an implicit work item when there is no active lock.

**Acceptance criteria:**
- [ ] `skills/use-mdf/SKILL.md` includes a concise shared rule for artifact storage.
- [ ] The rule covers active lock lookup, implicit work item fallback, revisioned artifacts, and latest pointers.
- [ ] The rule preserves existing entrypoint routing.

**Verification:**
- [ ] `node scripts/validate-agent-skills-port.js`
- [ ] Manual read-through confirms entrypoint routing and artifact storage rules do not contradict each other.

**Dependencies:** Task 1, Task 3

**Files likely touched:**
- `skills/use-mdf/SKILL.md`

**Estimated scope:** Small: 1 file

### Checkpoint: Discovery

- [ ] A skill running from a task worktree can determine `work_id`.
- [ ] A skill running without an active task can create an implicit work item.
- [ ] Cross-project discovery has a single registry source.

### Phase 3: Artifact-Producing Skills

## Task 5: Update define and planning artifacts

**Description:** Update `spec`, `spec-driven-development`, `plan`, `planning-and-task-breakdown`, `interview-me`, and `idea-refine` so they save their outputs as revisioned artifacts under the current work item instead of fixed tracked paths by default.

**Acceptance criteria:**
- [ ] `spec` saves to `.mdf/work/{work_id}/spec-NNN.md` by default, while this repository's development workflow may still use `SPEC.md` when the user explicitly invokes a repo-level spec.
- [ ] `plan` saves to `.mdf/work/{work_id}/plan-NNN.md` by default, not always `tasks/plan.md` and `tasks/todo.md`.
- [ ] `interview-me` and `idea-refine` use `intent-NNN.md` and `idea-NNN.md`.
- [ ] The instructions describe latest pointer updates.

**Verification:**
- [ ] `node scripts/validate-agent-skills-port.js`
- [ ] Manual scenario: running `spec` twice for the same work item creates `spec-001.md` then `spec-002.md`.

**Dependencies:** Task 4

**Files likely touched:**
- `skills/spec/SKILL.md`
- `skills/spec-driven-development/SKILL.md`
- `skills/plan/SKILL.md`
- `skills/planning-and-task-breakdown/SKILL.md`
- `skills/interview-me/SKILL.md`
- `skills/idea-refine/SKILL.md`

**Estimated scope:** Large: 6 files

## Task 6: Update build, test, debug, review, and ship artifacts

**Description:** Update implementation, testing, debugging, review, and launch readiness skills to record saved reports under the current work item with skill-specific artifact types.

**Acceptance criteria:**
- [ ] `build` and `incremental-implementation` use `build-NNN.md` when saving implementation logs.
- [ ] `test` and `test-driven-development` use `test-NNN.md` when saving test plans/results.
- [ ] `debugging-and-error-recovery` uses `debug-NNN.md`.
- [ ] `review` and `code-review-and-quality` use `review-NNN.md`.
- [ ] `ship` and `shipping-and-launch` use `ship-NNN.md`.

**Verification:**
- [ ] `node scripts/validate-agent-skills-port.js`
- [ ] Manual read-through confirms these skills do not imply tracked docs for local workflow reports.

**Dependencies:** Task 4

**Files likely touched:**
- `skills/build/SKILL.md`
- `skills/incremental-implementation/SKILL.md`
- `skills/test/SKILL.md`
- `skills/test-driven-development/SKILL.md`
- `skills/debugging-and-error-recovery/SKILL.md`
- `skills/review/SKILL.md`
- `skills/code-review-and-quality/SKILL.md`
- `skills/ship/SKILL.md`
- `skills/shipping-and-launch/SKILL.md`

**Estimated scope:** Large: 9 files

## Task 7: Update domain-specific artifact mappings

**Description:** Update domain workflow skills so contract-like, security, performance, UI, browser, context, CI, migration, commit, PR, and cleanup outputs use the current work item artifact layout.

**Acceptance criteria:**
- [ ] API/interface outputs use `contract-NNN.md`.
- [ ] Documentation/ADR-style local notes use `decision-NNN.md` by default and only promote to tracked docs on explicit request or policy.
- [ ] Migration/deprecation outputs use `migration-NNN.md`.
- [ ] Security, performance, UI, browser, context, CI/CD, commit, PR, and git cleanup outputs use their mapped artifact names.
- [ ] Existing behavior that creates real project files, commits, or PRs remains intact when explicitly requested.

**Verification:**
- [ ] `node scripts/validate-agent-skills-port.js`
- [ ] Manual read-through of each mapping against `SPEC.md`.

**Dependencies:** Task 4

**Files likely touched:**
- `skills/api-and-interface-design/SKILL.md`
- `skills/documentation-and-adrs/SKILL.md`
- `skills/deprecation-and-migration/SKILL.md`
- `skills/security-and-hardening/SKILL.md`
- `skills/performance-optimization/SKILL.md`
- `skills/frontend-ui-engineering/SKILL.md`
- `skills/browser-testing-with-devtools/SKILL.md`
- `skills/context-engineering/SKILL.md`
- `skills/ci-cd-and-automation/SKILL.md`
- `skills/github-commit/SKILL.md`
- `skills/github-pr/SKILL.md`
- `skills/github-clear-gone/SKILL.md`

**Estimated scope:** Large: 12 files

### Checkpoint: Artifact Coverage

- [ ] Every artifact-producing skill has a mapped artifact name.
- [ ] Contract-like artifacts default to `.mdf/work/{work_id}/`, not tracked docs.
- [ ] Real code/docs/commits/PR side effects still happen only when that skill's main purpose requires them.

### Phase 4: Command Shims and Documentation Consistency

## Task 8: Align command shims and repo docs

**Description:** Update command shims and repository documentation that describe task storage so they point users to the skill files and the new canonical root `.mdf` model.

**Acceptance criteria:**
- [ ] `commands/task.md` and `commands/tasks.md` remain thin shims.
- [ ] Any repo docs that still describe only `~/.mdf/projects/{project-hash}` are updated or marked legacy.
- [ ] The new storage model is findable from README or existing design docs if those docs already cover MDF task storage.

**Verification:**
- [ ] `rg "~/.mdf/projects|tasks/plan.md|SPEC.md" skills commands docs README.md`
- [ ] `node scripts/validate-agent-skills-port.js`

**Dependencies:** Tasks 1-7

**Files likely touched:**
- `commands/task.md`
- `commands/tasks.md`
- `README.md`
- `docs/superpowers/specs/2026-05-08-mdf-task-system-design.md`
- `docs/superpowers/plans/2026-05-08-mdf-task-system.md`

**Estimated scope:** Medium: 3-5 files, depending on references found

## Task 9: Final verification and consistency pass

**Description:** Run repository validation and inspect the final diff for contradictions, stale path references, and markdown formatting issues.

**Acceptance criteria:**
- [ ] Validation script passes.
- [ ] `git diff --check` passes.
- [ ] Remaining references to old storage are intentionally marked as legacy or are in historical docs.
- [ ] The final diff keeps changes scoped to skill instructions, command shims, and docs.

**Verification:**
- [ ] `node scripts/validate-agent-skills-port.js`
- [ ] `git diff --check`
- [ ] `rg "~/.mdf/projects|tasks/plan.md|tasks/todo.md|SPEC.md" skills commands docs README.md`

**Dependencies:** Tasks 1-8

**Files likely touched:**
- No new functional files expected

**Estimated scope:** Small: verification only

### Phase 5: Review Fixes and Legacy Migration

## Task 10: Fix project registry and ignore guards

**Description:** Update task/artifact initialization guidance so every `<canonical-root>/.mdf/` initialization upserts `~/.mdf/projects.json`, and so `.mdf/` writes stop unless `.mdf/` is already gitignored. The `.mdf/` ignore setup should mirror the existing `.worktrees/` setup branch and PR flow.

**Acceptance criteria:**
- [ ] `skills/task/SKILL.md` says initialization upserts `~/.mdf/projects.json` keyed by `canonical_root`.
- [ ] `skills/use-mdf/SKILL.md` says implicit work item creation follows the same registry upsert rule.
- [ ] `.mdf/` ignore guard stops before writing when `.mdf/` is not ignored.
- [ ] Setup branch guidance uses `chore/ignore-mdf` or `chore/ignore-local-workflow-state`, commits the ignore change, and optionally opens a PR with `release: none`.
- [ ] The original task/artifact write does not resume until the setup PR has merged.

**Verification:**
- [ ] `node scripts/validate-agent-skills-port.js`
- [ ] `git diff --check`
- [ ] Manual read-through confirms `tasks all` can discover projects after any `.mdf/` initialization.

**Dependencies:** Tasks 1-4

**Files likely touched:**
- `skills/task/SKILL.md`
- `skills/use-mdf/SKILL.md`
- `README.md`

**Estimated scope:** Medium: 3 files

## Task 11: Resolve status and spec artifact wording

**Description:** Fix documentation contradictions found during review: README must describe the new stored status model without the old no-status rule, and `spec` guidance must refer to the saved spec artifact instead of always referring to `SPEC.md`.

**Acceptance criteria:**
- [ ] README no longer says task files must not use `status` frontmatter for the new item-card model.
- [ ] README says `drop` and `clean` delete work item directories after confirmation.
- [ ] `skills/spec/SKILL.md` asks the user to review the saved spec artifact, mentioning `SPEC.md` only for explicit repo-level specs.
- [ ] `skills/spec-driven-development/SKILL.md` no longer treats committing specs to version control as the default for MDF workflow artifacts.

**Verification:**
- [ ] `node scripts/validate-agent-skills-port.js`
- [ ] `git diff --check`
- [ ] `rg "Task files must not use a `status`|reviewed SPEC.md|Commit the spec" README.md skills/spec/SKILL.md skills/spec-driven-development/SKILL.md`

**Dependencies:** Tasks 5, 8

**Files likely touched:**
- `README.md`
- `skills/spec/SKILL.md`
- `skills/spec-driven-development/SKILL.md`

**Estimated scope:** Small: 3 files

## Task 12: Add migrate-tasks skill and command

**Description:** Add a new `migrate-tasks` skill and `/mdf:migrate-tasks` command shim that copies legacy task state from `~/.mdf/projects/{project-hash}` into canonical project-root `.mdf/work/` storage.

**Acceptance criteria:**
- [ ] `skills/migrate-tasks/SKILL.md` exists with frontmatter and clear trigger description.
- [ ] `commands/migrate-tasks.md` is a thin shim that reads the skill and follows it.
- [ ] Migration defaults to dry-run/candidate listing and asks for confirmation before writing.
- [ ] Migration is copy-first and never deletes or moves legacy state.
- [ ] Migrated items preserve `legacy_id` and `legacy_source`.
- [ ] Legacy 3-digit IDs are converted to 4-digit IDs when possible; conflicts allocate the next available ID.
- [ ] Legacy locks are copied only after adding `canonical_root`, `work_id`, and new `task_id`.
- [ ] Migration updates `.mdf/index.jsonl` and `~/.mdf/projects.json`.
- [ ] Migration writes `.mdf/work/{work_id}/migration-NNN.md`.

**Verification:**
- [ ] `node scripts/validate-agent-skills-port.js`
- [ ] `git diff --check`
- [ ] Manual scenario review for queued, active, done, and conflicting legacy tasks.

**Dependencies:** Task 10

**Files likely touched:**
- `skills/migrate-tasks/SKILL.md`
- `commands/migrate-tasks.md`
- `skills/use-mdf/SKILL.md`
- `README.md`

**Estimated scope:** Medium: 3-4 files

## Task 13: Final verification after migration support

**Description:** Re-run validation and stale-reference checks after review fixes and migration support are added.

**Acceptance criteria:**
- [ ] Validation script passes.
- [ ] `git diff --check` passes.
- [ ] `migrate-tasks` appears in the relevant routing and README surfaces.
- [ ] Remaining legacy storage references are either current migration references or historical docs with historical notes.

**Verification:**
- [ ] `node scripts/validate-agent-skills-port.js`
- [ ] `git diff --check`
- [ ] `rg "migrate-tasks|~/.mdf/projects|SPEC.md|status frontmatter" skills commands docs README.md`

**Dependencies:** Tasks 10-12

**Files likely touched:**
- No new functional files expected

**Estimated scope:** Small: verification only

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| The change touches many skill files and becomes noisy | Medium | Land storage foundation first, then artifact-producing skills in grouped increments |
| Instructions conflict between entrypoint wrappers and underlying workflow skills | High | Update wrapper and underlying skill in the same task group and run a manual consistency pass |
| Historical docs still describe old storage | Medium | Decide whether to update, mark legacy, or leave as historical during Task 8 |
| Implicit work items make future task-first behavior unclear | Medium | Explicitly document implicit work items as current fallback and task-first as a future policy |
| Cross-project registry is underspecified | Medium | Keep `~/.mdf/projects.json` minimal in this change and avoid adding executable sync behavior |

## Open Questions

- What default expiration should each artifact type use?
- Should old `~/.mdf/projects/{project-hash}` state be migrated later or supported as legacy indefinitely?
- Should a dedicated `cleanup-docs` skill be added in this same feature or as a follow-up after storage behavior lands?
