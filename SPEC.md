# Spec: MDF Work Artifact Storage

## Objective

Update the MDF workflow skills so artifact-producing skills store their markdown outputs in a shallow, task-oriented, project-local `.mdf` structure instead of scattering durable documents through tracked project files or global task storage.

The primary users are engineers using MDF skills across multiple projects and worktrees. Success means an agent can resolve the current work item unambiguously, write each skill artifact to the correct place, and let a future cross-project board inspect work without reading every markdown file.

## Background

The current MDF task model stores task state under `~/.mdf/projects/{project-hash}/` and records locks there. That model is useful for global discovery, but it makes skill artifacts feel detached from the project and does not provide a clean place for spec, plan, review, ship, debug, and contract-like outputs.

The new model keeps authoritative workflow artifacts in the canonical project root:

```text
<canonical-project-root>/
  .mdf/
    project.json
    index.jsonl
    work/
      2026-05-26-0002-artifact-storage-policy/
        item.md
        spec-001.md
        plan-001.md
        build-001.md
        review-001.md
    locks/
      0002.lock
```

The `.mdf/` directory is gitignored by default and exists only at the canonical project root. Worktrees must not create their own independent `.mdf/` storage. When a skill runs from a worktree, it writes artifacts back to `<canonical_root>/.mdf/work/{work_id}/`.

## Tech Stack

This repository is a plugin/skills repository made of markdown skill instructions, command shims, agent prompts, documentation, and lightweight validation scripts.

Implementation should primarily edit:

```text
skills/task/SKILL.md
skills/tasks/SKILL.md
skills/spec/SKILL.md
skills/plan/SKILL.md
skills/build/SKILL.md
skills/test/SKILL.md
skills/review/SKILL.md
skills/ship/SKILL.md
skills/using-git-worktrees/SKILL.md
skills/migrate-tasks/SKILL.md
skills/*/SKILL.md where artifact behavior is described
commands/task.md
commands/tasks.md
commands/migrate-tasks.md
```

No MCP server, CLI helper, background daemon, event store, or generated runtime code is required for this change.

## Commands

Use the available repository checks:

```text
Validate skill port: node scripts/validate-agent-skills-port.js
Inspect changes: git diff --check
Review status: git status --short
```

If additional checks are discovered in this repository during implementation, use the existing documented commands rather than adding new tooling for this change.

## Project Structure

Runtime MDF storage should be documented as:

```text
<canonical-project-root>/.mdf/
  project.json       -> project metadata and canonical root
  index.jsonl        -> fast work item and artifact index
  work/              -> one directory per work item
  locks/             -> active task locks keyed by task id
```

Each work item uses a shallow directory:

```text
.mdf/work/{work_id}/
  item.md            -> thin work item card
  {type}-001.md      -> skill artifact revisions
  {type}-002.md
```

Global project discovery should be documented as:

```text
~/.mdf/projects.json
```

`~/.mdf/projects.json` is a registry of known projects and their canonical roots. It is not the authoritative store for per-project artifact content.

Whenever a skill initializes `<canonical-project-root>/.mdf/`, it must upsert the project into `~/.mdf/projects.json`. The upsert key is `canonical_root`, not `remote`, because projects may not have a remote and multiple checkouts may share one remote.

Registry entries should include:

```json
{
  "id": "1d55c7f13adf",
  "name": "midnight-forge",
  "canonical_root": "/Users/example/code/midnight-forge",
  "remote": "https://github.com/example/midnight-forge.git",
  "index": ".mdf/index.jsonl",
  "last_seen": "2026-05-26T10:00:00+09:00"
}
```

The `id` is the first 12 lowercase hex characters of SHA-256 over `remote` when present, otherwise over `canonical_root`. Upserts must preserve unrelated project entries.

## Gitignore Guard

Before creating or writing `<canonical-root>/.mdf/`, skills must verify that `.mdf/` is ignored by git when inside a git repository.

If `.mdf/` is not ignored:

1. Do not create or write `.mdf/`.
2. Offer to create a setup branch that adds `.mdf/` to `.gitignore`.
3. Perform setup from the normal repository checkout, not from a task worktree.
4. Stop first if the checkout has uncommitted changes.
5. Add `.mdf/` without changing unrelated ignore rules.
6. Commit with `chore: ignore local mdf state`.
7. If the user wants, push and open a PR with release intent `release: none`.
8. Do not resume the original task or artifact write until the setup PR has been merged.

If `.worktrees/` also needs to be ignored, the setup branch may add both `.worktrees/` and `.mdf/` with commit message `chore: ignore local workflow state`.

## Work Item Model

A work item is the durable unit of workflow context.

```text
Work Item = one work context
- Explicit task exists: kind = "task"
- No task exists yet: kind = "implicit"
```

Current behavior should allow implicit work items because MDF does not yet require every skill run to start from `task add` or `task work`. Future behavior may forbid implicit work items and require task creation first without changing the storage layout.

Work item IDs use date, sequence, and slug:

```text
2026-05-26-0002-artifact-storage-policy
```

The work item directory uses the same ID:

```text
.mdf/work/2026-05-26-0002-artifact-storage-policy/
```

## Current Work Resolution

Artifact-producing skills must resolve the current work item before writing anything:

1. Determine the current git root or current working directory.
2. If running inside `<canonical_root>/.worktrees/<branch>`, resolve `canonical_root` from an active lock or `~/.mdf/projects.json`.
3. Read `<canonical_root>/.mdf/locks/*.lock`.
4. If a lock's `worktree` matches the current checkout root and includes `work_id`, use that work item.
5. If there is exactly one active lock for the current checkout context, use its `work_id`.
6. If no matching lock exists, create an implicit work item under `<canonical_root>/.mdf/work/`.
7. Never create a separate `.mdf/` inside a linked worktree.

Lock files should include:

```json
{
  "task_id": "0002",
  "work_id": "2026-05-26-0002-artifact-storage-policy",
  "canonical_root": "/absolute/project/root",
  "worktree": "/absolute/project/root/.worktrees/task-0002-artifact-storage-policy",
  "branch": "task-0002-artifact-storage-policy",
  "started": "2026-05-26T10:00:00+09:00",
  "runtime": "codex"
}
```

## Artifact Rules

All artifact-producing skills write markdown artifacts to:

```text
<canonical_root>/.mdf/work/{work_id}/{type}-NNN.md
```

Repeated runs create new revisions:

```text
spec-001.md
spec-002.md
spec-003.md
```

The work item card updates `latest` pointers:

```yaml
latest:
  spec: "spec-003.md"
  plan: "plan-001.md"
  review: "review-002.md"
```

Each artifact file includes frontmatter:

```yaml
---
work_id: "2026-05-26-0002-artifact-storage-policy"
task_id: "0002"
type: "spec"
revision: 3
created: "2026-05-26T10:30:00+09:00"
expires: "2026-06-09"
supersedes: "spec-002.md"
---
```

Contract-like outputs are still local MDF artifacts by default. They should use `contract-001.md`, `decision-001.md`, `migration-001.md`, or another specific artifact type under the work item directory. They are only promoted to tracked project docs when the user explicitly asks or project policy requires it.

## Skill Artifact Mapping

| Skill | Artifact file |
| --- | --- |
| `task add` | `.mdf/work/{work_id}/item.md` |
| `task work` | `.mdf/locks/{task_id}.lock` and `.mdf/work/{work_id}/worktree-001.md` when a setup note is useful |
| `task done` | update `.mdf/work/{work_id}/item.md`, delete `.mdf/locks/{task_id}.lock` |
| `interview-me` | `.mdf/work/{work_id}/intent-001.md` |
| `idea-refine` | `.mdf/work/{work_id}/idea-001.md` |
| `spec` / `spec-driven-development` | `.mdf/work/{work_id}/spec-001.md` |
| `plan` / `planning-and-task-breakdown` | `.mdf/work/{work_id}/plan-001.md` |
| `build` / `incremental-implementation` | `.mdf/work/{work_id}/build-001.md` |
| `test` / `test-driven-development` | `.mdf/work/{work_id}/test-001.md` |
| `debugging-and-error-recovery` | `.mdf/work/{work_id}/debug-001.md` |
| `review` / `code-review-and-quality` | `.mdf/work/{work_id}/review-001.md` |
| `ship` / `shipping-and-launch` | `.mdf/work/{work_id}/ship-001.md` |
| `doubt-driven-development` | `.mdf/work/{work_id}/doubt-001.md` |
| `documentation-and-adrs` | `.mdf/work/{work_id}/decision-001.md` |
| `api-and-interface-design` | `.mdf/work/{work_id}/contract-001.md` |
| `deprecation-and-migration` | `.mdf/work/{work_id}/migration-001.md` |
| `security-and-hardening` | `.mdf/work/{work_id}/security-001.md` |
| `performance-optimization` | `.mdf/work/{work_id}/performance-001.md` |
| `frontend-ui-engineering` | `.mdf/work/{work_id}/ui-001.md` |
| `browser-testing-with-devtools` | `.mdf/work/{work_id}/browser-001.md` |
| `context-engineering` | `.mdf/work/{work_id}/context-001.md` for analysis; actual rules files remain in their normal project locations when explicitly created |
| `ci-cd-and-automation` | `.mdf/work/{work_id}/ci-001.md` |
| `github-commit` | `.mdf/work/{work_id}/commit-001.md` |
| `github-pr` | `.mdf/work/{work_id}/pr-001.md` |
| `github-clear-gone` | `.mdf/work/{work_id}/git-cleanup-001.md` |
| `migrate-tasks` | `.mdf/work/{work_id}/migration-001.md` |
| `tasks` | response body by default; `.mdf/work/{work_id}/tasks-001.md` only when saved |
| future `cleanup-docs` | `.mdf/work/{work_id}/cleanup-001.md` when saved |

## Legacy Task Migration

Add a `migrate-tasks` skill and `/mdf:migrate-tasks` command shim to migrate existing legacy task state from:

```text
~/.mdf/projects/{project-hash}/
  meta.json
  counter.json
  tasks/
  locks/
```

to:

```text
<canonical-root>/.mdf/
  project.json
  index.jsonl
  work/
  locks/
```

Migration rules:

- Copy first; never move or delete legacy files during migration.
- Default to dry-run/candidate listing before writing.
- Ask for explicit confirmation before writing new `.mdf` files.
- Require the `.mdf/` gitignore guard to pass before writing.
- Preserve `legacy_id` and `legacy_source` in migrated `item.md` frontmatter.
- Convert legacy 3-digit IDs to 4-digit IDs when no conflict exists, e.g. `"001"` -> `"0001"`.
- If the target task ID or work item directory conflicts, allocate the next available 4-digit task ID and preserve `legacy_id`.
- Copy legacy locks only after adding `canonical_root`, `work_id`, and the new `task_id`; preserve `legacy_id`.
- Update `.mdf/index.jsonl` and `~/.mdf/projects.json`.
- Write a migration report to `.mdf/work/{work_id}/migration-NNN.md`.
- Legacy cleanup is out of scope and requires a separate explicit confirmation flow.

Example migrated item frontmatter:

```yaml
---
work_id: "2026-05-08-0001-fix-login-timeout"
task_id: "0001"
legacy_id: "001"
kind: "task"
title: "Fix login timeout"
order: 1
status: "done"
created: "2026-05-08"
due: "2026-05-10"
completed: "2026-05-12"
worktree: null
branch: null
latest: {}
legacy_source: "~/.mdf/projects/{project-hash}/tasks/001.md"
---
```

## Code Style

Skill instructions should use direct imperative language and concrete paths. Prefer explicit algorithms over vague guidance.

Good style:

```markdown
Before writing an artifact, resolve `canonical_root` and `work_id`.
Write the artifact to `<canonical_root>/.mdf/work/{work_id}/{type}-NNN.md`.
Do not create `.mdf/` inside a linked worktree.
```

Avoid:

```markdown
Save this somewhere appropriate.
Keep useful notes near the task.
```

When editing markdown tables, keep columns small and path examples exact.

## Testing Strategy

This is a markdown-instruction change, so verification is mostly static and scenario-based.

Required checks:

```text
node scripts/validate-agent-skills-port.js
git diff --check
```

Manual review scenarios:

1. Normal checkout on `main` starts `task work 0002`.
   - Expected: worktree is created under `.worktrees/`.
   - Expected: lock is written to canonical root `.mdf/locks/0002.lock`.
   - Expected: lock includes `canonical_root`, `worktree`, `branch`, and `work_id`.
2. `spec` runs from the task worktree.
   - Expected: artifact goes to `<canonical_root>/.mdf/work/{work_id}/spec-001.md`.
   - Expected: no `.mdf/` is created inside the worktree.
3. `spec` runs again for the same active work item.
   - Expected: `spec-002.md` is created.
   - Expected: `item.md` points `latest.spec` to `spec-002.md`.
4. A skill runs without an active lock.
   - Expected: an implicit work item is created.
   - Expected: the artifact is stored in that implicit work item.
5. Cross-project listing reads `~/.mdf/projects.json`.
   - Expected: project entries point to canonical roots and local `.mdf/index.jsonl` files.
6. `.mdf/` is not gitignored.
   - Expected: task/artifact initialization stops and offers a setup branch/PR instead of writing `.mdf/`.
7. Legacy tasks exist under `~/.mdf/projects/{project-hash}`.
   - Expected: `migrate-tasks` lists candidates, copies confirmed tasks into `.mdf/work/`, preserves `legacy_id`, and leaves legacy files untouched.

## Boundaries

- Always: keep `.mdf/` project-local and gitignored by default.
- Always: use canonical project root `.mdf/` as the only authoritative artifact store for a project.
- Always: keep work item storage shallow: `.mdf/work/{work_id}/{artifact}`.
- Always: write a new revision when the same skill runs again for the same work item.
- Always: update `item.md` latest pointers and `.mdf/index.jsonl` when artifacts are created.
- Always: upsert `~/.mdf/projects.json` when initializing project-local `.mdf/`.
- Always: stop before writing `.mdf/` when `.mdf/` is not gitignored, and offer a setup branch/PR.
- Always: migrate legacy task state by copying, never moving or deleting.
- Ask first: promoting any MDF artifact into tracked docs.
- Ask first: deleting or migrating existing `~/.mdf/projects/{project-hash}` task state.
- Ask first: adding executable tooling beyond markdown skill instructions.
- Never: create a separate `.mdf/` inside a linked worktree.
- Never: overwrite a previous artifact revision.
- Never: require every skill run to have an explicit task until the task-first policy is intentionally introduced.
- Never: delete legacy task files during migration.

## Success Criteria

- `task` and `tasks` skills describe the canonical root `.mdf` storage model.
- `using-git-worktrees` explains that worktrees do not get independent `.mdf/` storage.
- Artifact-producing entrypoint skills describe their output path under `.mdf/work/{work_id}/`.
- Locks include enough metadata for a skill running inside a worktree to find the current work item.
- The documented model supports both explicit task work items and implicit work items.
- The documented model supports future task-first behavior without changing the storage layout.
- Project-local `.mdf/` initialization updates `~/.mdf/projects.json` so `tasks all` can discover the project.
- `.mdf/` setup follows the same stop/setup-branch/PR safety pattern as `.worktrees/`.
- `migrate-tasks` can copy existing legacy tasks and locks into the new work item layout without deleting legacy state.
- Verification commands pass.

## Open Questions

- What default expiration should each artifact type use?
- Should legacy cleanup after successful migration be handled by `migrate-tasks` later, or by a separate cleanup skill?
