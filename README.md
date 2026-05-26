# Midnight Forge

Midnight Forge (`mdf`) is a harness for solo developers, built to work across Claude Code and Codex.

## v1 Scope

- Product name: `midnight-forge`
- Plugin namespace: `mdf`
- Shared source of truth: root `skills/` directory
- Supported runtimes: Claude Code and Codex
- Included MDF skills: `mdf-handshake`, `task`, `tasks`
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

MDF only writes `.mdf/` after confirming it is ignored by git. If `.mdf/` is not ignored, the task flow stops and offers a setup branch/PR that adds `.mdf/` to `.gitignore` with release intent `release: none`.

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

Task files must not use a `status` frontmatter field. `drop` and `clean` require explicit confirmation before deleting task files.

## Worktree Policy

Midnight Forge includes a `using-git-worktrees` skill for implementation work that must not touch `main` or the repository default branch. MDF worktrees are always project-local:

```text
.worktrees/<branch-name>
```

The skill stops on ambiguous state instead of warning and continuing. `.worktrees/` must already be ignored by git; the skill does not edit `.gitignore`. After creating a worktree, it may copy common local environment files and install dependencies, but it does not run tests, builds, lint checks, write task locks, create commits, or prepare PRs.

`$task work <id>` uses this worktree policy before marking a task active. If worktree setup fails, the task remains queued and no lock is written. When setup succeeds, the task lock records the resulting worktree path and branch. Natural-language requests such as "start the next queued task" are mapped to the first queued task and then use the same `work <id>` behavior.

If task work cannot start because `.worktrees/` is not ignored, `$task work <id>` treats that as repository setup, not task work. It leaves the task queued, asks whether to create a `chore/ignore-worktrees` setup branch, adds `.worktrees/` to `.gitignore`, commits the change, and opens a `release: none` PR when the user agrees. The original task is not locked or resumed until that setup PR has been merged and `work <id>` is run again.

## PR Policy

Midnight Forge includes a `github-pr` skill for GitHub pull request preparation. Before drafting or creating a PR, the skill completes the MDF task identified by the current session context. Active lock files validate that selected task; they do not select a task by themselves, and the skill never completes a task solely because it is the only active lock.

When the session identifies exactly one valid active MDF task, `github-pr` uses the `task` skill's completion behavior with the log message `Completed task before PR preparation.`, then continues PR preparation. If the session task is ambiguous or conflicts with local task, worktree, or branch state, PR preparation stops for user clarification.

MDF also includes simple git workflow skills modeled after Claude Code's `commit-commands` plugin:

- `github-commit`: inspect status, diff, branch, and recent commits, then create one commit.
- `github-pr`: use `github-commit` when uncommitted changes exist, prepare a GitHub PR body with summary, test plan, MDF task note, and release intent, and push/run `gh pr create` only when explicitly asked.
- `github-clear-gone`: clean local `[gone]` branches and associated worktrees after explicit confirmation.

## Agent Skills Workflows

These workflows reference and vendor the original [agent-skills](https://github.com/addyosmani/agent-skills) workflow system.

Midnight Forge vendors the original `agent-skills` materials into native plugin paths:

- `skills/`: original workflow/domain skills plus Codex entrypoints
- `references/`: testing, security, performance, accessibility, and orchestration references
- `agents/`: local persona prompts for `code-reviewer`, `security-auditor`, and `test-engineer`

The `use-mdf` meta skill routes development workflow decisions such as spec, plan, build, test, review, simplify, ship, debugging, UI, API/interface, security, performance, documentation, migration, task lifecycle, worktree, commit, GitHub PR, and gone branch cleanup work. The original `test-driven-development` name is preserved; see `references/agent-skills-port-notes.md` for the collision check and fallback strategy.

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

Every PR must include one release intent line in the PR body, title, or labels:

```text
release: major
release: minor
release: patch
release: none
release: 0.1.0
```

When a PR is merged to `main`, the release workflow reads the merged PR intent. If a release is requested, it syncs the Claude Code and Codex plugin manifest versions, updates `CHANGELOG.md`, commits `chore(release): vX.Y.Z`, creates an annotated tag, and creates a GitHub Release. npm publishing is intentionally not part of this workflow.
