---
name: github-pr
description: "Use when preparing, creating, or reviewing a GitHub pull request for MDF work; completes the current session's MDF task before PR preparation when the session context identifies exactly one task."
---

# GitHub PR

## Overview

Prepare GitHub pull requests for MDF-managed work. This skill enforces the MDF lifecycle rule that the task for the current session is completed before PR preparation continues.

This skill is LLM-driven. Do not use an MCP server, background runner, or network service. Use local files and git state first. Only run GitHub CLI commands when the user explicitly asks to create or inspect a remote PR.

## PR Preflight

Before drafting, creating, or updating a PR:

1. Check git status and current branch.
2. Confirm the work is not being prepared from `main` or the repository default branch.
3. If there are uncommitted changes, use the `github-commit` skill to create one commit before PR preparation continues.
4. Run the MDF task completion guard below.
5. Confirm the GitHub CLI is available and authenticated before creating a remote PR.
6. Confirm the repository has an `origin` remote.
7. Summarize relevant commits, changed files, verification evidence, and release intent.

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

1. Load `tasks/{id}.md`; stop if it is missing or malformed.
2. Reject the task if frontmatter already has `completed`.
3. Load `locks/{id}.lock`; stop if it is missing, unreadable, or malformed.
4. If the lock and task disagree on task ID, stop.

### Step 3: Validate Repository Context

Compare the selected task against local git state:

1. Read the current worktree path and branch.
2. If the lock has `worktree`, it must match the current worktree path unless the session explicitly explains why PR preparation is happening from another checkout.
3. If the lock has `branch`, it must match the current branch unless the session explicitly explains why PR preparation is happening from another branch.
4. If current branch or worktree points to a different MDF task than the selected session task, stop.

Multiple active locks are allowed when the session task is clear and the selected task passes validation.

### Step 4: Complete the Task

When the selected session task passes validation, use the `task` skill's `done {id} --message "message"` completion behavior with this message:

```text
Completed task before PR preparation.
```

This keeps the `task` skill as the source of truth for completion behavior: it adds `completed: YYYY-MM-DD`, appends the log message, and deletes `locks/{id}.lock`.

Report that MDF task `{id}` was completed before PR preparation.

Do not complete any other active task.

## PR Preparation

After the MDF task completion guard succeeds or determines there is no MDF task for this PR, prepare the PR:

1. Summarize the branch and base branch.
2. Analyze all commits in the branch, not just the latest commit.
3. Summarize changed files and notable commits.
4. Include verification commands and outcomes.
5. Include the completed MDF task ID when one was completed.
6. Include release intent when the repository requires it.
7. Draft a concise PR title and body.

Use this simple PR body shape:

```markdown
## Summary
- ...
- ...

## Test Plan
- [ ] ...

## MDF
- Completed task: ...

release: none
```

Keep the summary to 1-3 bullets. Include a test plan checklist even when verification was not run; mark unchecked items honestly.

For this repository, every PR must include one release intent line in the PR body, title, or labels:

```text
release: major
release: minor
release: patch
release: none
release: 0.1.0
```

If release intent is not clear, ask the user before creating the PR.

## Stop Conditions

Stop instead of continuing when:

- The current branch is `main` or the repository default branch.
- `github-commit` cannot create a commit from uncommitted changes.
- The session does not identify exactly one MDF task and task completion is needed.
- The selected task file is missing, malformed, or already completed.
- The selected lock file is missing, unreadable, or malformed.
- Session task context conflicts with current worktree or branch.
- Release intent is required and unclear.

## Boundaries

This skill may complete the current session's MDF task when the guard passes, but it must use the `task` skill completion behavior rather than editing task files directly. This skill may use `github-commit` before PR preparation when uncommitted changes exist.

Do not run `gh pr create` unless the user explicitly asks to create the PR. When asked to create the PR, push the current branch to `origin` first if needed, then create the PR with `gh pr create`.
