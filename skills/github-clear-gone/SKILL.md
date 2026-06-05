---
name: github-clear-gone
description: "Use when cleaning local git branches marked gone after remote deletion; lists gone branches, removes associated worktrees after confirmation, and deletes stale local branches."
---

# GitHub Clear Gone

When saving gone-branch cleanup reports, resolve the current MDF work item and write `.mdf/work/{work_id}/git-cleanup-NNN.md`. This report is separate from the actual branch or worktree deletions, which still require explicit confirmation.

## Overview

Clean up local branches whose upstream branches were deleted. This is based on the simple `clean_gone` command workflow.

## Workflow

1. Refresh remote branch state when appropriate:

```bash
git fetch --prune
```

2. List local branches and identify `[gone]` entries:

```bash
git branch -v
```

3. List worktrees:

```bash
git worktree list
```

4. For every `[gone]` branch, identify whether it has an associated worktree. Branches with a `+` prefix in `git branch -v` usually do.
5. For every associated worktree, check whether it has uncommitted changes:

```bash
git -C "<worktree-path>" status --short
```

6. Show the exact branches and worktree paths that would be removed, including each associated worktree's dirty/clean status. If a worktree is dirty, include the `git status --short` output.
7. Ask for explicit confirmation before deleting anything. Dirty worktrees require separate explicit confirmation that names the dirty worktree path and acknowledges uncommitted changes will be discarded.
8. After confirmation, remove associated worktrees first, then delete the local branches. Do not remove a dirty worktree unless the separate dirty-worktree confirmation was given.
9. Report what was removed. If no branches are marked `[gone]`, report that no cleanup was needed.

## Deletion Commands

For each confirmed gone branch:

```bash
git worktree remove --force "<worktree-path>"
git branch -D "<branch-name>"
```

Only run `git worktree remove` when the worktree path is not the current repository root. Use `--force` only after the clean/dirty status has been shown and the required confirmation has been given.

## Boundaries

Never delete branches that are not marked `[gone]`. Never delete the current branch. Never delete worktrees or branches without explicit confirmation. Never delete a dirty worktree without separate explicit confirmation that acknowledges uncommitted changes will be discarded.
