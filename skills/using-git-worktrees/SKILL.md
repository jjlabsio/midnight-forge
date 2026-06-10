---
name: using-git-worktrees
description: "Use before implementation work, MDF task work, build, commits, or PR preparation when work must happen outside main/default branch; creates or enters an isolated project-local .worktrees git worktree."
---

# Using Git Worktrees

## Overview

Ensure implementation work happens in an isolated git worktree under the project root's `.worktrees/` directory. This skill follows the same basic detection model as Superpowers' `using-git-worktrees` skill, with MDF-specific policy choices:

- Use only project-local `.worktrees/<branch-name>` paths.
- Stop on ambiguous or conflicting state instead of warning and continuing.
- Do not use global fallback directories.
- Do not run tests, builds, or lint checks.
- Copy local environment files and install dependencies only after the worktree is created.

This skill guarantees an isolated workspace. The caller remains responsible for task locks, commit workflow, PR workflow, and test/build verification.

MDF workflow state is not stored in linked worktrees. The canonical project root owns `.mdf/`, and a linked worktree under `<project-root>/.worktrees/<branch-name>` must not create its own independent `.mdf/` directory. Caller workflows should record `canonical_root` in task locks and write artifacts to `<canonical_root>/.mdf/work/{work_id}/`.

## Step 0: Detect Existing Isolation

Before creating anything, check whether the current checkout is already an isolated worktree:

```bash
git_dir=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
git_common=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
branch=$(git branch --show-current)
default_branch=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')
if [ -z "$default_branch" ]; then
  default_branch=$(git remote show origin 2>/dev/null | sed -n 's/.*HEAD branch: //p')
fi
superproject=$(git rev-parse --show-superproject-working-tree 2>/dev/null)
```

If this is not a git repository, stop.

If `superproject` is non-empty, stop. Submodules are not treated as isolated MDF worktrees.

If `git_dir != git_common`, the current checkout is already a linked worktree:

1. Require a non-empty branch name. If HEAD is detached, stop.
2. Stop if the branch is `main` or the repository default branch. A linked worktree is only acceptable when it is isolated from main/default branch work.
3. If the caller provided an expected MDF task lock worktree path, it must equal the current worktree path. If it does not match, stop.
4. Report the current worktree path and branch.
5. Continue using the current worktree. Do not create another worktree.

If `git_dir == git_common`, the current checkout is a normal repository checkout. Continue to Step 1.

## Step 1: Choose Branch and Path

Use a caller-provided branch name when available. For MDF task work, the branch name should be derived by the caller from the task ID and title:

```text
task-002-worktree-pr-lifecycle-guardrails
```

If no branch name is provided, derive a short lowercase slug from the requested work. Keep the branch name ASCII, git-safe, and human-readable.

The worktree path is always:

```text
<project-root>/.worktrees/<branch-name>
```

Do not use `worktrees/`, `~/.config/superpowers/worktrees/`, `~/.mdf/worktrees/`, or any other fallback location.

Do not copy or initialize `.mdf/` in the new worktree. `.mdf/` remains at `<project-root>/.mdf/`, where `<project-root>` is the canonical root used to create the worktree.

## Step 2: Validate Safety

Run these checks before creating the worktree:

```bash
project_root=$(git rev-parse --show-toplevel)
default_branch=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')
if [ -z "$default_branch" ]; then
  default_branch=$(git remote show origin 2>/dev/null | sed -n 's/.*HEAD branch: //p')
fi
git fetch origin "$default_branch"
git show-ref --verify --quiet "refs/remotes/origin/$default_branch"
test -f "$project_root/.mdf/project/init.json"
git check-ignore -q "$project_root/.worktrees/"
git show-ref --verify --quiet "refs/heads/<branch-name>"
test -e "$project_root/.worktrees/<branch-name>"
```

Stop if the repository does not have an `origin` remote, if the default branch cannot be resolved from `origin/HEAD` or `git remote show origin`, if fetching `origin/<default-branch>` fails, or if `origin/<default-branch>` does not exist.

Stop if MDF project init is missing. Stop if `.worktrees/` is not ignored. Do not edit `.gitignore` from this skill; instruct the user to run `mdf init`.

Stop if the target branch already exists. Ask the user whether to reuse, rename, or delete the existing branch.

Stop if the target path already exists. Ask the user whether to reuse, rename, or remove the existing path.

If `git worktree list --porcelain` shows broken or prunable worktrees, report them. Do not prune or delete them automatically.

## Step 3: Create Worktree

Create the isolated workspace from the fetched remote default branch, not from the local default branch:

```bash
git worktree add "$project_root/.worktrees/<branch-name>" -b "<branch-name>" "origin/$default_branch"
```

Do not create new worktrees from a stale local `main` or stale local default branch. The remote default branch is the required base for new implementation worktrees.

If creation fails, stop and report the exact failure. Do not continue in the normal checkout.

## Step 4: Copy Environment Files

After the worktree is created, copy common local environment files from the source project root to the new worktree when they exist in the source and do not already exist in the worktree:

```text
.env
.env.local
.env.development
.env.test
.envrc
```

Do not overwrite existing files in the worktree. Do not copy files outside this explicit list unless the user asks.

## Step 5: Install Dependencies

Install dependencies in the new worktree only when a recognized manifest or lockfile exists:

```bash
cd "$project_root/.worktrees/<branch-name>"
```

Use the package manager implied by lockfiles, in this order:

1. `pnpm-lock.yaml`: run `pnpm install`
2. `yarn.lock`: run `yarn install`
3. `bun.lock` or `bun.lockb`: run `bun install`
4. `package-lock.json`: run `npm install`
5. `package.json`: run `npm install`
6. `Cargo.toml`: run `cargo fetch`
7. `go.mod`: run `go mod download`
8. `requirements.txt`: run `pip install -r requirements.txt`
9. `pyproject.toml`: run the existing project manager if obvious from project files; otherwise skip and report that dependency setup needs manual selection

If dependency installation fails, stop and report the failure. Do not run tests, builds, lint checks, or baseline verification from this skill.

## Step 6: Report

Report:

```text
Worktree ready at <full-path>
Branch: <branch-name>
Base: origin/<default-branch>
Canonical root: <project-root>
Dependency setup: <completed|skipped|failed>
Ready for caller workflow to continue
```

The caller workflow should continue from the worktree path.

## Stop Conditions

Stop instead of warning and continuing when:

- The current directory is not a git repository.
- The current directory is inside a submodule.
- The current checkout is detached.
- The current linked worktree is on `main` or the repository default branch.
- The current linked worktree does not match the caller's expected MDF task lock path.
- The repository does not have an `origin` remote.
- The remote default branch cannot be resolved, fetched, or verified.
- MDF project init is missing or `.worktrees/` is not ignored.
- The target branch already exists.
- The target path already exists.
- `git worktree add` fails.
- Environment file copying fails.
- Dependency installation fails.

## Caller Responsibilities

This skill does not write MDF task locks. For MDF task work, the `task` skill should call this skill before creating a lock, then write `locks/{id}.lock` using the resulting worktree path and branch. In the canonical storage model, the actual lock path is `<canonical-root>/.mdf/locks/{id}.lock`, and the lock should include `canonical_root`, `work_id`, `worktree`, and `branch`.

This skill does not prepare commits or PRs. Commit and PR lifecycle checks should live in dedicated MDF workflow skills.
