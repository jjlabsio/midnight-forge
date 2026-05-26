---
name: github-pr
description: "Use when creating or updating a GitHub pull request for MDF work; completes the current session's MDF task before PR creation when the session context identifies exactly one task."
---

# GitHub PR

## Overview

Create or update GitHub pull requests for MDF-managed work. Invoking this skill means the user is asking to create or update the remote GitHub PR for the current MDF work. Do not stop after drafting a PR unless a stop condition is hit.

This skill enforces the MDF lifecycle rule that the task for the current session is completed before PR creation continues.

This skill is LLM-driven. Do not use an MCP server, background runner, or network service. Use local files, git state, and GitHub CLI commands.

Do not save PR drafts or PR creation records under `.mdf/`; GitHub is the source of truth for PR state.

## PR Preflight

Before creating or updating a PR:

1. Check git status and current branch.
2. Confirm the work is not being prepared from `main` or the repository default branch.
3. If there are uncommitted changes, use the `github-commit` skill to create one commit before PR creation continues.
4. Run the MDF task completion guard below.
5. Confirm the GitHub CLI is available and authenticated before creating a remote PR.
6. Confirm the repository has an `origin` remote.
7. Summarize relevant commits, changed files, verification evidence, and release signal.

Do not create a PR from uncommitted changes. Use `github-commit` first.

## MDF Task Completion Guard

Session context is the primary selector for the task to complete. Active lock files validate the selected task; they do not select it by themselves.

Never complete an MDF task solely because it is the only active lock.

### Step 1: Identify the Session Task

Determine whether the current conversation clearly identifies one MDF task as the task for this PR. Valid session signals include:

- The user explicitly named a task ID for this work, such as `002`, `task 002`, `$task work 002`, or "002 작업".
- The assistant created or replaced `locks/{id}.lock` in this session.
- The assistant reported a worktree or branch for a specific task in this session.
- The current work description clearly matches exactly one MDF task title already discussed in this session.

If the session context does not identify exactly one task ID, stop and ask the user which MDF task this PR should complete. Do this even when there is only one active lock.

If the session context identifies more than one plausible task ID, stop and ask the user to choose one.

### Step 2: Validate Files

For the selected task ID:

1. Find exactly one `.mdf/work/*/item.md` whose frontmatter `task_id` matches the selected task ID; stop if it is missing, duplicated, unreadable, or malformed.
2. Reject the task if frontmatter already has `status: "done"` or `completed`.
3. Load `.mdf/locks/{id}.lock`; stop if it is missing, unreadable, or malformed.
4. If the lock and item disagree on task ID or work ID, stop.

### Step 3: Validate Repository Context

Compare the selected task against local git state:

1. Read the current worktree path and branch.
2. If the lock has `worktree`, it must match the current worktree path unless the session explicitly explains why PR creation is happening from another checkout.
3. If the lock has `branch`, it must match the current branch unless the session explicitly explains why PR creation is happening from another branch.
4. If current branch or worktree points to a different MDF task than the selected session task, stop.

Multiple active locks are allowed when the session task is clear and the selected task passes validation.

### Step 4: Complete the Task

When the selected session task passes validation, use the `task` skill's `done {id} --message "message"` completion behavior with this message:

```text
Completed task before PR creation.
```

This keeps the `task` skill as the source of truth for completion behavior: it adds `completed: YYYY-MM-DD`, appends the log message, and deletes `locks/{id}.lock`.

Report that MDF task `{id}` was completed before PR creation.

Do not complete any other active task.

## PR Creation

After the MDF task completion guard succeeds or determines there is no MDF task for this PR, create or update the remote PR:

1. Summarize the branch and base branch.
2. Analyze all commits in the branch, not just the latest commit.
3. Summarize changed files and notable commits.
4. Include verification commands and outcomes.
5. Include the completed MDF task ID when one was completed.
6. Draft a concise Conventional Commit PR title and body.
7. Include the `release-none` label only when the PR should not release.
8. Push the current branch to `origin`.
9. Check whether an open PR already exists for the current branch.
10. If an open PR exists, report its URL instead of creating a duplicate.
11. If no open PR exists, create one with `gh pr create`.

Before drafting PR title prose or PR body bullet prose, follow `../../references/human-facing-language.md`. Keep required PR template headings, release labels, file paths, commands, and repository conventions exactly as specified.

Use a Conventional Commit style PR title:

```text
type(optional-scope): summary
```

Examples:

```text
docs: add human-facing language policy
feat(github-pr): create remote PRs by default
fix(github-pr): avoid defaulting release intent to none
```

Use this simple PR body shape:

```markdown
## Summary
- ...
- ...

## Test Plan
- [ ] ...

## MDF
- Completed task: ...
```

Keep the summary to 1-3 bullets. Include a test plan checklist even when verification was not run; mark unchecked items honestly.

For this repository, normal release behavior is derived from the PR title. Use Conventional Commit style:

```text
feat: add capability
fix: correct behavior
docs: update release policy
chore: update workflow
refactor: simplify parser
perf: improve resolver speed
```

`feat` creates a minor release. `fix`, `docs`, `chore`, `refactor`, `perf`, `test`, `ci`, and `build` create patch releases. Add `!` after the type or scope for a major release.

Do not add release-intent lines to the PR body. If the PR should not release, apply the `release-none` label and use a non-release PR title. If the release signal is not clear, ask the user before creating the PR.

Do not require a second explicit confirmation before pushing or creating the PR. This skill invocation is the PR creation request.

## Stop Conditions

Stop instead of continuing when:

- The current branch is `main` or the repository default branch.
- `github-commit` cannot create a commit from uncommitted changes.
- The session does not identify exactly one MDF task and task completion is needed.
- The selected task file is missing, malformed, or already completed.
- The selected lock file is missing, unreadable, or malformed.
- Session task context conflicts with current worktree or branch.
- The GitHub CLI is unavailable or not authenticated.
- The repository does not have an `origin` remote.
- Release signal is required and unclear.
- Pushing the branch fails.
- `gh pr create` fails.

## Boundaries

This skill may complete the current session's MDF task when the guard passes, but it must use the `task` skill completion behavior rather than editing task files directly. This skill may use `github-commit` before PR creation when uncommitted changes exist.

When invoked, push the current branch to `origin` and create a GitHub PR with `gh pr create`. If an open PR already exists for the current branch, report its URL instead of creating a duplicate. Do not require a second explicit confirmation for PR creation.
