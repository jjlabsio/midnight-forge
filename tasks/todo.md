# Todo: MDF Work Artifact Storage

- [x] Task 1: Define canonical `.mdf` storage in task lifecycle
  - Acceptance: `skills/task/SKILL.md` defines canonical root `.mdf/project.json`, `.mdf/index.jsonl`, `.mdf/work/`, `.mdf/locks/`, `work_id`, `item.md`, and lock metadata with `canonical_root`.
  - Verify: `node scripts/validate-agent-skills-port.js`
  - Files: `skills/task/SKILL.md`

- [x] Task 2: Document canonical-root behavior in worktree setup
  - Acceptance: `skills/using-git-worktrees/SKILL.md` says worktrees must not create independent `.mdf/` storage and caller workflows use the canonical root from locks.
  - Verify: `node scripts/validate-agent-skills-port.js`
  - Files: `skills/using-git-worktrees/SKILL.md`

- [x] Task 3: Update tasks board and cross-project discovery
  - Acceptance: `skills/tasks/SKILL.md` reads project-local `.mdf/index.jsonl`, `.mdf/work/*/item.md`, `.mdf/locks/*.lock`, and uses `~/.mdf/projects.json` for all-project discovery.
  - Verify: `node scripts/validate-agent-skills-port.js`
  - Files: `skills/tasks/SKILL.md`

- [x] Task 4: Add shared artifact resolution rules to workflow entrypoints
  - Acceptance: `skills/use-mdf/SKILL.md` explains active lock resolution, implicit work item fallback, revisioned artifact files, and latest pointer updates.
  - Verify: `node scripts/validate-agent-skills-port.js`
  - Files: `skills/use-mdf/SKILL.md`

- [x] Task 5: Update define and planning artifacts
  - Acceptance: define/planning skills save `intent-NNN.md`, `idea-NNN.md`, `spec-NNN.md`, and `plan-NNN.md` under `.mdf/work/{work_id}/` by default.
  - Verify: `node scripts/validate-agent-skills-port.js`
  - Files: `skills/spec/SKILL.md`, `skills/spec-driven-development/SKILL.md`, `skills/plan/SKILL.md`, `skills/planning-and-task-breakdown/SKILL.md`, `skills/interview-me/SKILL.md`, `skills/idea-refine/SKILL.md`

- [x] Task 6: Update build, test, debug, review, and ship artifacts
  - Acceptance: implementation and verification skills save local workflow reports under `.mdf/work/{work_id}/` with mapped artifact names.
  - Verify: `node scripts/validate-agent-skills-port.js`
  - Files: `skills/build/SKILL.md`, `skills/incremental-implementation/SKILL.md`, `skills/test/SKILL.md`, `skills/test-driven-development/SKILL.md`, `skills/debugging-and-error-recovery/SKILL.md`, `skills/review/SKILL.md`, `skills/code-review-and-quality/SKILL.md`, `skills/ship/SKILL.md`, `skills/shipping-and-launch/SKILL.md`

- [x] Task 7: Update domain-specific artifact mappings
  - Acceptance: domain skills use `contract`, `decision`, `migration`, `security`, `performance`, `ui`, `browser`, `context`, `ci`, `commit`, `pr`, and `git-cleanup` artifact names as appropriate.
  - Verify: `node scripts/validate-agent-skills-port.js`
  - Files: `skills/api-and-interface-design/SKILL.md`, `skills/documentation-and-adrs/SKILL.md`, `skills/deprecation-and-migration/SKILL.md`, `skills/security-and-hardening/SKILL.md`, `skills/performance-optimization/SKILL.md`, `skills/frontend-ui-engineering/SKILL.md`, `skills/browser-testing-with-devtools/SKILL.md`, `skills/context-engineering/SKILL.md`, `skills/ci-cd-and-automation/SKILL.md`, `skills/github-commit/SKILL.md`, `skills/github-pr/SKILL.md`, `skills/github-clear-gone/SKILL.md`

- [x] Task 8: Align command shims and repo docs
  - Acceptance: command shims remain thin, docs either use the new canonical `.mdf` model or mark old storage descriptions as legacy.
  - Verify: `rg "~/.mdf/projects|tasks/plan.md|SPEC.md" skills commands docs README.md` and `node scripts/validate-agent-skills-port.js`
  - Files: `commands/task.md`, `commands/tasks.md`, `README.md`, `docs/superpowers/specs/2026-05-08-mdf-task-system-design.md`, `docs/superpowers/plans/2026-05-08-mdf-task-system.md`

- [x] Task 9: Final verification and consistency pass
  - Acceptance: validation passes, markdown diff is clean, and stale storage references are intentional.
  - Verify: `node scripts/validate-agent-skills-port.js`, `git diff --check`, `rg "~/.mdf/projects|tasks/plan.md|tasks/todo.md|SPEC.md" skills commands docs README.md`
  - Files: final consistency pass only
