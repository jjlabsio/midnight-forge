---
name: github-after-merge
description: "Use after a GitHub PR has been merged to return to the default branch, fast-forward it, and hand off gone branch/worktree cleanup to github-clear-gone."
---

# GitHub After Merge

Use this skill after a PR created from an MDF worktree has been merged and the
user wants the local session ready for the next task or code exploration.

This skill owns the post-merge transition. `github-pr` stops at PR creation; it
does not wait for review, CI, merge, or cleanup. Run this as a later follow-up
once the user says the PR was merged or asks to sync after merge.

## Workflow

1. Identify the PR to verify.
   - Prefer an explicit PR number or URL from the user.
   - Otherwise, infer it from the current branch with `gh pr view`.
   - If no PR can be identified, ask for the PR number or URL.
2. Verify the PR is merged:

```bash
gh pr view <pr> --json state,mergedAt,headRefName,baseRefName,url
```

If `mergedAt` is empty, stop and report that cleanup waits until the PR is
merged. Do not switch branches, pull, or delete anything.

3. Resolve the canonical repository checkout.
   - If running inside `<canonical-root>/.worktrees/<branch>`, use
     `<canonical-root>` for all default-branch sync and cleanup commands.
   - Otherwise, use `git rev-parse --show-toplevel`.
   - Do not create or write MDF task state from this skill.
4. In the canonical checkout, stop if there are uncommitted changes:

```bash
git status --short
```

5. Resolve the remote default branch:

```bash
default_branch=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')
if [ -z "$default_branch" ]; then
  default_branch=$(git remote show origin 2>/dev/null | sed -n 's/.*HEAD branch: //p')
fi
```

6. Move the canonical checkout to the default branch and update it:

```bash
git checkout "$default_branch"
git fetch --prune origin
git pull --ff-only origin "$default_branch"
```

If checkout, fetch, or pull fails, stop and report the exact failure. Do not
delete branches or worktrees.

7. Use `github-clear-gone` to clean stale local branches and associated
worktrees.
   - Follow `github-clear-gone` exactly.
   - Show deletion candidates first.
   - Require explicit user confirmation before removing any branch or worktree.
   - Never delete branches that are not marked `[gone]`.

8. Report the final state:
   - merged PR URL
   - default branch and latest commit
   - whether cleanup was completed, skipped, or waiting for confirmation
   - that subsequent code exploration or task work should start from the
     updated default branch

## Stop Conditions

Stop instead of continuing when:

- The PR cannot be identified.
- The PR is not merged.
- The current directory is not in a git repository.
- The repository has no `origin` remote.
- The default branch cannot be resolved.
- The canonical checkout has uncommitted changes.
- Checking out or fast-forwarding the default branch fails.
- `github-clear-gone` requires confirmation and the user has not confirmed.

## Boundaries

Do not merge PRs. Do not create commits. Do not push. Do not delete current or
non-gone branches. Do not remove worktrees without explicit confirmation through
`github-clear-gone`.
