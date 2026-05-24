---
name: github-clear-gone
description: "Use when cleaning local git branches marked gone after remote deletion; lists gone branches, removes associated worktrees after confirmation, and deletes stale local branches."
---

# GitHub Clear Gone

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
5. Show the exact branches and worktree paths that would be removed.
6. Ask for explicit confirmation before deleting anything.
7. After confirmation, remove associated worktrees first, then delete the local branches.
8. Report what was removed. If no branches are marked `[gone]`, report that no cleanup was needed.

## Deletion Commands

For each confirmed gone branch:

```bash
git worktree remove --force "<worktree-path>"
git branch -D "<branch-name>"
```

Only run `git worktree remove` when the worktree path is not the current repository root.

## Boundaries

Never delete branches that are not marked `[gone]`. Never delete the current branch. Never delete worktrees or branches without explicit confirmation.
