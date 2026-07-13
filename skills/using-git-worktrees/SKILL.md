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
- Copy local environment files, install dependencies, and run conventional generated-client setup only after the worktree is created.

This skill guarantees an isolated workspace. The caller remains responsible for task locks, commit workflow, PR workflow, and test/build verification.

This skill only prepares or selects an isolated workspace. It does not authorize implementation by itself. After reporting the worktree, return to the caller workflow and continue only within that workflow's explicit scope.

MDF workflow state is not stored in linked worktrees. The canonical project root owns `.mdf/`, and a linked worktree under `<project-root>/.worktrees/<branch-name>` must not create its own independent `.mdf/` directory. Caller workflows should record `canonical_root` in task locks and write artifacts to `<canonical_root>/.mdf/work/{work_id}/`.

All worktree checks and changes are model-led. Inspect Git, the canonical MDF
root, remotes, ignore rules, existing worktrees, branches, and local setup
files directly, then explain the result before any write. Keep the caller's
task intent, branch naming, lock ownership, conflict explanation, and reuse or
removal decision separate from mechanical facts. A failed or ambiguous check
is a stop; never infer success from a partial command result.

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

After the worktree is created, copy every root-level local environment file from the source project root to the new worktree when it exists in the source and does not already exist in the worktree.

Root-level environment files are regular files directly under `<project-root>` whose basename starts with `.env`, such as `.env`, `.env.local`, `.env.development`, `.env.development.local`, `.env.test`, and `.env.production.local`.

Do not overwrite existing files in the worktree. Do not recursively copy app-level or package-level environment files such as `apps/web/.env.local` or `packages/api/.env`. Do not copy files outside the root-level `.env*` pattern unless the user asks.

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

## Step 6: Generate Prisma Client When Detected

After dependency installation succeeds or is skipped because no recognized dependency manifest exists, run Prisma client generation when the repository or one of its packages appears to use Prisma. Prefer existing `package.json` scripts over direct package-manager commands because project scripts often encode custom schema paths, dotenv loading, or monorepo fan-out.

Scan `package.json` files inside the resulting worktree while excluding `node_modules`, `.git`, and `.worktrees`.

Use the package manager implied by the nearest lockfile when obvious, walking from the package directory up to the worktree root. If no nearer package manager is obvious, reuse the root package manager selected during dependency installation. If no package manager was selected but a `package.json` exists, use `npm`.

Apply this order:

1. If the root `package.json` has any script whose value contains `prisma generate`, run one matching script from the worktree root. Prefer script names in this order when present: `prisma:generate`, `db:generate`, `generate`, then the first matching script in `package.json` order. If the root script succeeds, do not run package-level Prisma generation. If it fails, stop.
2. If no root script ran, scan non-root `package.json` files. For each package whose scripts contain `prisma generate`, run one matching script from that package directory, using the same script-name preference order. Run at most one matching script per package.
3. If no matching script ran for a package, including the root package, but that package appears to use Prisma, run a fallback generate command from that package directory. Run at most one fallback per package.

A package appears to use Prisma when its `dependencies` or `devDependencies` include `prisma` or `@prisma/client`, or when `prisma/schema.prisma` exists under that package directory.

Use these commands:

```text
pnpm: pnpm run <script> / pnpm prisma generate
npm: npm run <script> / npm exec prisma generate
yarn: yarn <script> / yarn prisma generate
bun: bun run <script> / bunx prisma generate
```

If Prisma generation fails, stop and report the package directory and command that failed. Do not start Docker services automatically from this skill.

## Step 7: Report

Report:

```text
Worktree ready at <full-path>
Branch: <branch-name>
Base: origin/<default-branch>
Canonical root: <project-root>
Dependency setup: <completed|skipped|failed>
Environment setup: <copied|skipped|failed>
Prisma setup: <completed|skipped|failed>
Ready for caller workflow to resume within its requested scope
```

The caller workflow should continue from the worktree path only within the scope it already requested.

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
- Prisma generation fails.

## Caller Responsibilities

This skill does not write MDF task locks. For MDF task work, the `task` skill should call this skill before creating a lock, then write `locks/{id}.lock` using the resulting worktree path and branch. In the canonical storage model, the actual lock path is `<canonical-root>/.mdf/locks/{id}.lock`, and the lock should include `canonical_root`, `work_id`, `worktree`, and `branch`.

This skill does not prepare commits or PRs. Commit and PR lifecycle checks should live in dedicated MDF workflow skills.
