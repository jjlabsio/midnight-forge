# Midnight Forge

Midnight Forge (`mdf`) is a harness for solo developers, built to work across Claude Code and Codex.

## v1 Scope

- Product name: `midnight-forge`
- Plugin namespace: `mdf`
- Shared source of truth: root `skills/` directory
- Supported runtimes: Claude Code and Codex
- Included MDF skills: `mdf-handshake`, `task`, `tasks`, `migrate-tasks`
- Included agent-skills workflows: `spec`, `plan`, `build`, `test`, `review`, `code-simplify`, `ship`, plus the original agent-skills domain skills, references, and specialist persona prompts

## Intentionally Excluded

v1 does not include setup, MCP servers, runners, background jobs, model orchestration, or persistence outside the documented local task system. Agent-skills workflows are exposed as normal Codex plugin skills and local Markdown prompts; they do not require a separate repository checkout or external service.

## Install

### Claude Code

Add the GitHub-hosted Claude Code marketplace:

```text
/plugin marketplace add jjlabsio/midnight-forge
```

Install the `mdf` plugin:

```text
/plugin install mdf@midnight-forge
```

Invoke the handshake through the Claude command shim:

```text
/mdf:mdf-handshake
```

Invoke the task skills through Claude Code:

```text
/mdf:task add "Write the release checklist"
/mdf:task work 001
/mdf:tasks
/mdf:tasks all
/mdf:migrate-tasks
```

### Codex

Install the released plugin through the GitHub-hosted Codex marketplace:

```bash
codex plugin marketplace add jjlabsio/midnight-forge
```

Then open the Codex Plugin Directory, select the `Midnight Forge` marketplace, and install or enable `mdf`.

Invoke the shared skill through Codex skills:

```text
$mdf-handshake
```

Invoke the task skills through Codex:

```text
$task add "Write the release checklist"
$task work 001
$tasks
$tasks all
$migrate-tasks
```

Invoke the agent-skills workflow entrypoints through Codex:

```text
$spec
$plan
$build
$test
$review
$code-simplify
$ship
```

The entrypoints are thin wrappers around the original agent-skills workflows. They preserve the original command distinctions between required startup skills, conditional escalation, optional checklists, and the `ship` persona fan-out flow.

The normal MDF workflow is:

```text
spec -> plan -> build -> review -> ship
```

`spec`, `plan`, and `build` use inline loops by default. `spec` and `plan` draft reviewed workflow artifacts before implementation. `build` processes the approved plan with task-level verification and review loops. Codex may run build-internal reviews inline, but task review and whole-build review still produce separate `.mdf/work/{work_id}/review-NNN.md` artifacts; summaries inside `build-NNN.md` do not satisfy those gates. `review` remains the independent standalone review step when desired before PR, merge, or ship. `ship` remains the final GO/NO-GO gate. `test` and `review` are still standalone quality tools for independent verification, manual changes, debugging, PR preparation, and pre-ship checks.

High-risk work has heavier gates by design. During `plan`, every approved SPEC requirement is classified as `normal` or `high-risk` by semantic judgment, not by keyword list. High-risk requirements record the implementation meaning, required scenario, negative scenario, and verification before build work starts. During `build`, each completed planned task saves a task-level build artifact with `Task Acceptance Traceability`, and the final build saves a separate `Whole-Build Spec Traceability` artifact against the approved spec. Task-scope and whole-build review artifacts run spec-compliance review before the normal five-axis code-quality review for MDF-managed work.

When a plan contains high-risk requirements, or build discovers a new high-risk semantic concern, `build` must pass a mandatory high-risk independent review before claiming completion. Fresh-context or subagent review is used only when the current user explicitly authorizes subagents/delegation/parallel agent work and the runtime exposes the needed tools. Otherwise the gate still runs as a standalone-like inline pass and records its freshness explicitly.

Example: if a spec requires a continued DB-backed job to be reselected within the same bounded scheduler invocation, evidence that only verifies persisted `continued` state is insufficient. The build evidence and independent review must verify the internal continuation loop itself; relying on a later external wake-up or recovery violates the stronger same-invocation guarantee.

## Task System

Midnight Forge includes a first-pass local task system built from LLM-driven skills:

- Codex: `$task`, `$tasks`
- Claude Code: `/mdf:task`, `/mdf:tasks`

Task state is local-only and gitignored under the canonical project root:

```text
<canonical-project-root>/.mdf/
  project.json
  index.jsonl
  work/
  locks/
```

Linked worktrees do not get their own `.mdf/` directory. A task running from `<canonical-project-root>/.worktrees/<branch>` still writes MDF state and artifacts to `<canonical-project-root>/.mdf/`.

MDF only writes `.mdf/` after confirming it is ignored by git. If `.mdf/` is not ignored, the task flow stops and offers a setup branch/PR that adds `.mdf/` to `.gitignore` and applies the `release-none` label.

Cross-project discovery uses a lightweight registry:

```text
~/.mdf/projects.json
```

Because `.mdf/` is gitignored, task state and workflow artifacts are not committed, pushed, or shared with teammates through PRs unless the user explicitly promotes a document into tracked project files.

Each task-backed work item has an item card at `.mdf/work/{work_id}/item.md` with YAML frontmatter plus these fixed English body sections:

```markdown
## Context

## Files

## Criteria

## Log
```

Task status is stored in the item card and reconciled with locks:

- `.mdf/locks/{task_id}.lock` exists: active
- Otherwise `status: "done"` or `completed` exists: done
- Otherwise: queue

`drop` and `clean` require explicit confirmation before deleting work item directories.

Legacy task stores under `~/.mdf/projects/{project-hash}` can be copied into canonical `.mdf/work/` storage with `$migrate-tasks` or `/mdf:migrate-tasks`. Migration is dry-run first, requires explicit confirmation before writing, preserves `legacy_id` and `legacy_source`, and never deletes, moves, or rewrites legacy files.

## Worktree Policy

Midnight Forge includes a `using-git-worktrees` skill for implementation work that must not touch `main` or the repository default branch. MDF worktrees are always project-local:

```text
.worktrees/<branch-name>
```

The skill stops on ambiguous state instead of warning and continuing. `.worktrees/` must already be ignored by git; the skill does not edit `.gitignore`. New worktrees are created from the fetched remote default branch, not from a potentially stale local default branch. After creating a worktree, it may copy common local environment files and install dependencies, but it does not run tests, builds, lint checks, write task locks, create commits, or prepare PRs.

`$task work <id>` uses this worktree policy before marking a task active. If worktree setup fails, the task remains queued and no lock is written. When setup succeeds, the task lock records the resulting worktree path and branch. Natural-language requests such as "start the next queued task" are mapped to the first queued task and then use the same `work <id>` behavior.

If task work cannot start because `.worktrees/` is not ignored, `$task work <id>` treats that as repository setup, not task work. It leaves the task queued, asks whether to create a `chore/ignore-worktrees` setup branch, adds `.worktrees/` to `.gitignore`, commits the change, and opens a no-release PR with the `release-none` label when the user agrees. The original task is not locked or resumed until that setup PR has been merged and `work <id>` is run again.

## PR Policy

Midnight Forge includes a `github-pr` skill for GitHub pull request creation. Before creating or updating a PR, the skill completes the MDF task identified by the current session context. Active lock files validate that selected task; they do not select a task by themselves, and the skill never completes a task solely because it is the only active lock.

When the session identifies exactly one valid active MDF task, `github-pr` first fetches the remote base branch and verifies that the current branch merges cleanly. It then uses the `task` skill's completion behavior with the log message `Completed task before PR creation.`, pushes the branch, and creates a GitHub PR. If an open PR already exists for the branch, it reports that PR instead of creating a duplicate. If the session task is ambiguous, conflicts with local task/worktree/branch state, or does not merge cleanly into the remote base branch, PR creation stops for user clarification.

MDF also includes simple git workflow skills modeled after Claude Code's `commit-commands` plugin:

- `github-commit`: inspect status, diff, branch, and recent commits, then create one commit.
- `github-pr`: use `github-commit` when uncommitted changes exist, prepare a Conventional Commit PR title plus a body with summary, test plan, and MDF task note, then push and create the remote PR.
- `github-clear-gone`: clean local `[gone]` branches and associated worktrees after explicit confirmation.

## Agent Skills Workflows

These workflows reference and vendor the original [agent-skills](https://github.com/addyosmani/agent-skills) workflow system.

Midnight Forge vendors the original `agent-skills` materials into native plugin paths:

- `skills/`: original workflow/domain skills plus Codex entrypoints
- `references/`: testing, security, performance, accessibility, and orchestration references
- `agents/`: local persona prompts for `code-reviewer`, `security-auditor`, `test-engineer`, `spec-evaluator`, and `plan-evaluator`

The `use-mdf` meta skill routes development workflow decisions such as spec, plan, build, test, review, simplify, ship, debugging, UI, API/interface, security, performance, documentation, migration, task lifecycle, worktree, commit, GitHub PR, and gone branch cleanup work. The original `test-driven-development` name is preserved; see `references/agent-skills-port-notes.md` for the collision check and fallback strategy.

The recommended happy path for planned work is `spec -> plan -> build -> review -> ship` when independent review is desired. `spec`, `plan`, and `build` use inline loops by default: `spec` and `plan` run inline blocker-oriented self-review before saving artifacts, and `build` runs inline implementation, verification, task review, and whole-build review gates.

Subagent-assisted evaluator, build, or review modes require both explicit current-user authorization for subagents/delegation/parallel agent work and runtime tool availability. When those conditions are met, `agents/spec-evaluator.md` and `agents/plan-evaluator.md` can be used as optional prompt templates for narrow blocker review. Without both conditions, normal workflow gates stay inline. `build` may invoke test and review logic internally as quality gates, but `$test` and `$review` remain useful on their own for independent verification, manual edits, debugging, PR preparation, and pre-ship checks.

Human-facing prose in review and PR workflows follows the user's apparent conversation language. Fixed workflow artifacts remain stable: MDF schema keys, task section headings, file paths, commands, code identifiers, branch names, release labels, required PR template headings, and repository conventions are preserved as written.

## Local Smoke Tests

These commands are for validating local plugin changes before release. They are separate from the normal install flow above.

### Claude Code

Run Claude Code with the local plugin directory:

```bash
cd /Users/jaejinsong/code/projects/plugins
claude --plugin-dir ./midnight-forge
```

Then run:

```text
/mdf:mdf-handshake
```

### Codex

Create a temporary Codex marketplace at `/Users/jaejinsong/code/projects/plugins/.agents/plugins/marketplace.json`:

```json
{
  "name": "local-plugins",
  "interface": {
    "displayName": "Local Plugins"
  },
  "plugins": [
    {
      "name": "mdf",
      "source": {
        "source": "local",
        "path": "./midnight-forge"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

Register the local marketplace root:

```bash
codex plugin marketplace add /Users/jaejinsong/code/projects/plugins
```

Restart Codex, install or enable `mdf` from the `Local Plugins` marketplace, then run:

```text
$mdf-handshake
```

The temporary marketplace file is only for local testing and is not part of the v1 plugin skeleton.

## Expected Output

```text
midnight-forge skill loaded
runtime: Codex
cwd: /path/to/current/project
mode: plugin skill only; no setup, MCP, rules, runner, or harness workflow used
```

Claude Code should report `runtime: Claude Code` for the same skill.

## Release

Releases are PR-based. Do not release directly from `main`.

Normal release behavior is derived from the merged PR title using Conventional Commit style. `feat` creates a minor release. `fix`, `docs`, `chore`, `refactor`, `perf`, `test`, `ci`, and `build` create patch releases. Add `!` after the type or scope for a major release.

PR bodies are not release signal sources. If a PR should not release, apply the `release-none` label and use a non-release PR title. Exact manual versions are handled through the release workflow's `version` dispatch input.

When a PR is merged to `main`, the release workflow reads the merged PR title and labels. If a release is requested, it syncs the Claude Code and Codex plugin manifest versions, updates `CHANGELOG.md`, commits `chore(release): vX.Y.Z`, creates an annotated tag, and creates a GitHub Release. npm publishing is intentionally not part of this workflow.
