---
name: github-pr
description: "Use when creating or updating a GitHub pull request for MDF work; completes an incomplete current-session task or validates handoff for an already-completed task when the session identifies exactly one task."
---

# GitHub PR

## Overview

Create or update GitHub pull requests for MDF-managed work. Invoking this skill means the user is asking to create or update the remote GitHub PR for the current MDF work. Do not stop after drafting a PR unless a stop condition is hit.

This skill enforces the MDF lifecycle rule with two handoff paths. An incomplete task must be active and is completed before PR creation; an already-completed task is validated for handoff without repeating task completion, except for the explicit MDF init setup PR mode documented below.

PRs are ready for review by default. Do not pass `--draft`, do not set `draft: true`, and do not report `isDraft=true` unless the user explicitly asks for a draft PR in the current request.

This skill is LLM-driven. Do not use an MCP server, background runner, or network service. Use local files, git state, and GitHub CLI commands.

Do not save PR drafts or PR creation records under `.mdf/`; GitHub is the source of truth for PR state.

## PR Modes

### Auto-workflow Handoff

When `auto-workflow` reaches `github-pr`, first use the production MDF controller
to observe the external boundary and prepare the handoff. The handoff must carry
the canonical task, spec, plan, build, review, and current-tree ship GO references.
The controller computes the local branch, HEAD, dirty state, upstream, and ahead
count directly and performs read-only `gh repo view` and `gh pr list` observations.
Callers pass only the optional canonical mutation-authority file; never pass
asserted Git/GitHub facts. The controller records raw command outputs and command
sidecars but does not commit, push, label, or create a pull request. Release
selection and all external mutations remain authoritative in this skill.

If the controller returns a typed stop because the worktree, upstream state,
GitHub observation, existing pull requests, or mutation authority is ambiguous, stop
before any external mutation. Otherwise continue with the normal MDF task PR mode
and the preflight below. Do not reconstruct or bypass controller evidence from
artifact presence or caller assertions.

### Normal MDF Task PR Mode

Use this mode for ordinary MDF task-backed work. The MDF task completion guard is required and must complete exactly one session-identified task before pushing or creating/updating a PR.

### MDF Init Setup PR Mode

Use this mode only when `init` delegates setup PR creation/update after it has already created a setup branch and setup commit. This mode is for setup branches such as `chore/mdf-init-local-state` or `chore/mdf-init-docs`, where no task-backed work item should be completed.

In MDF init setup PR mode:

- Bypass the MDF task completion guard only because `init` is the caller and the setup branch flow is not task-backed.
- Preserve the setup lifecycle: after creating or reporting the PR, stop and tell the user to rerun `mdf init` after the setup PR is merged.
- Use the setup PR title and body intent provided by `init`; do not duplicate that setup decision logic inside this skill.
- Apply `release-none` when the repository has that label. If the label is missing, continue without creating a draft PR or changing PR readiness.
- Keep the PR ready for review unless the user explicitly asked for a draft PR.
- Do not complete or mutate any `.mdf/work/*/item.md` task state.

## PR Preflight

Before creating or updating a PR:

1. Check git status and current branch.
2. Confirm the work is not being prepared from `main` or the repository default branch.
3. If there are uncommitted changes, use the `github-commit` skill to create one commit before PR creation continues.
4. Confirm the GitHub CLI is available and authenticated before creating a remote PR.
5. Confirm the repository has an `origin` remote.
6. Fetch the remote base branch and run the mergeability preflight below.
7. Run the MDF task completion guard below, except in MDF init setup PR mode.
8. Load the human-facing PR language using the PR language preflight below.
9. Summarize relevant commits, changed files, verification evidence, release signal, and the selected human-facing PR language.

Do not create a PR from uncommitted changes. Use `github-commit` first.

## PR Language Preflight

Before drafting a PR title or body, read `~/.mdf/user/preferences.json` and use its non-empty `human_language` value for human-facing PR prose. If the file is missing, unreadable, malformed, or `human_language` is empty, continue with English as the fallback language instead of stopping PR creation.

Record the selected language in the PR preflight summary:

```text
Human-facing PR language: Korean
```

or, when falling back:

```text
Human-facing PR language: English (fallback)
```

Do not infer or write `human_language` during PR creation. This workflow only reads the preference when it exists.

## Mergeability Preflight

Before completing the MDF task or pushing the branch, verify that the current branch can merge cleanly into the remote base branch:

```bash
base_branch=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')
if [ -z "$base_branch" ]; then
  base_branch=$(git remote show origin 2>/dev/null | sed -n 's/.*HEAD branch: //p')
fi
git fetch origin "$base_branch"
git merge-tree --write-tree HEAD "origin/$base_branch"
```

If `git merge-tree --write-tree` exits non-zero, stop before task completion and PR creation. Report the conflicted files and tell the user the branch must be rebased onto `origin/<base-branch>` first. Do not push or create/update the PR while this preflight fails.

## MDF Task Completion Guard

Session context is the primary selector for the task to complete. Active lock files validate the selected task; they do not select it by themselves.

Never complete an MDF task solely because it is the only active lock.

### Step 1: Identify the Session Task

Determine whether the current conversation clearly identifies one MDF task as the task for this PR. Valid session signals include:

- The user explicitly named a task ID for this work, such as `002`, `task 002`, `$task work 002`, or `work 002`.
- The assistant created or replaced `locks/{id}.lock` in this session.
- The assistant reported a worktree or branch for a specific task in this session.
- The current work description clearly matches exactly one MDF task title already discussed in this session.

If the session context does not identify exactly one task ID, stop and ask the user which MDF task this PR should complete. Do this even when there is only one active lock.

If the session context identifies more than one plausible task ID, stop and ask the user to choose one.

### Step 2: Validate Files

For the selected task ID:

1. Find exactly one `.mdf/work/*/item.md` whose frontmatter `task_id` matches the selected task ID; stop if it is missing, duplicated, unreadable, or malformed.
2. Determine the handoff path from frontmatter:
   - For an incomplete task, require `status: "active"`; a queued task cannot be handed off to a PR.
   - For an already-completed task, accept `status: "done"` or a `completed` field and validate it through the completed-task path.
   - Treat `completed` combined with `status: "queue"` or `status: "active"` as contradictory completion metadata and stop.
   - Stop on any other malformed or contradictory completion metadata.
3. For an incomplete task, load `.mdf/locks/{id}.lock`; stop if it is missing, unreadable, or malformed. The lock must match the selected task's `task_id` and `work_id`.
4. For an already-completed task, the handoff does not require a lock. Require persisted `worktree` and `branch` fields and validate both against the current checkout. This path must not create, replace, or delete a lock.
5. If an already-completed task still has a matching lock, stop with a task-state consistency warning rather than silently deleting or recreating it.
6. If the lock and item disagree on task ID or work ID, stop.

### Step 3: Validate Repository Context

Compare the selected task against local git state:

1. Read the current worktree path and branch.
2. For the incomplete-task path, the lock's `worktree` and `branch` must match the current checkout unless the session explicitly explains why PR creation is happening from another checkout or branch.
3. For the already-completed task path, the item's persisted `worktree` and `branch` must match the current checkout exactly.
4. If current branch or worktree points to a different MDF task than the selected session task, stop.

Multiple active locks are allowed when the session task is clear and the selected task passes validation.

### Step 4: Complete the Task

When an incomplete selected session task passes validation, use the `task` skill's `done {id} --message "message"` completion behavior with this message:

```text
Completed task before PR creation.
```

This keeps the `task` skill as the source of truth for completion behavior: it adds `completed: YYYY-MM-DD`, appends the log message, and deletes `locks/{id}.lock`.

Report that MDF task `{id}` was completed before PR creation. When the selected task is already completed, report that the completed task passed handoff validation instead.

When the selected task is already completed, do not call `task done`, recreate or remove its lock, or mutate its task card. Do not complete any other active task.

## PR Creation

After either task handoff path succeeds, or after MDF init setup PR mode explicitly bypasses task completion, create or update the remote PR:

1. Summarize the branch and base branch.
2. Analyze all commits in the branch, not just the latest commit.
3. Summarize changed files and notable commits.
4. Include verification commands and outcomes.
5. Include the completed MDF task ID when one was completed.
6. Draft a concise Conventional Commit PR title and body using the selected human-facing PR language.
7. Run the PR language gate below and revise the draft until it passes.
8. Include the `release-none` label only when the PR should not release. In MDF init setup PR mode, setup PRs should not release.
9. Push the current branch to `origin`.
10. Check whether an open PR already exists for the current branch.
11. If an open PR exists, update it when the current task changed the intended PR title or body; otherwise report its URL instead of creating a duplicate.
12. If no open PR exists, create one with `gh pr create`. Do not include `--draft` unless the user explicitly asked for a draft PR.

GitHub is the source of truth for whether an open PR already exists; do not add a PR-status field to MDF task cards.

Before drafting PR title prose or PR body bullet prose, follow `../../references/human-facing-language.md`. Keep required PR template headings, release labels, file paths, commands, and repository conventions exactly as specified.

Use the selected human-facing PR language for:

- The PR title summary prose after the Conventional Commit prefix.
- PR body bullet prose.
- `Service Impact` explanatory prose.
- `Operational Checklist` item prose.
- `Test Plan` explanatory prose.

Preserve these fixed contract elements exactly as written:

- PR template headings such as `## Summary`, `## Design`, `## Service Impact`, `## Operational Checklist`, `## Test Plan`, and `## MDF`.
- Conventional Commit type and scope prefixes such as `docs:`, `fix:`, and `feat(github-pr):`.
- File paths, commands, labels, code identifiers, branch names, task IDs, and repository-required conventions.

### PR Language Gate

Before running `gh pr create` or `gh pr edit`, verify:

- The human-facing PR language was read from `~/.mdf/user/preferences.json`, or English fallback was explicitly selected.
- Human-facing title and body prose use the selected language.
- Fixed headings, commands, paths, labels, Conventional Commit prefixes, and repository contracts remain untranslated.
- The PR is ready for review by default; `--draft`, `draft: true`, and `isDraft=true` are absent unless the user explicitly asked for a draft PR.

If this gate fails, revise the PR title or body before creating or updating the PR. Do not run `gh pr create` or `gh pr edit` with prose in the wrong language.

Use a Conventional Commit style PR title:

```text
type(optional-scope): summary
```

Examples:

```text
docs: add human-facing language policy
feat(github-pr): create remote PRs by default
fix(github-pr): avoid defaulting release signal to none
```

Use this simple PR body shape:

```markdown
## Summary
- ...
- ...

## Design
- ...

## Service Impact
- ...

## Operational Checklist
- [ ] ...

## Test Plan
- [ ] ...

## MDF
- Completed task: ...
```

Keep the summary to 1-3 bullets focused on what changed at the product or service level. Use `Design` for the large technical shape of the work: architecture boundaries, public interface choices, data flow, compatibility decisions, or why the chosen approach fits the codebase. Do not turn `Design` into a file-by-file implementation log.

Before drafting `Service Impact` and `Operational Checklist`, perform an external operations impact scan for external state outside the repository. Check whether the change adds, removes, renames, or stops reading environment variables or secrets; changes deployment platform or secret-store configuration; affects third-party integration dashboards; requires webhook, cron, and queue providers to be created, changed, disabled, or cleaned up; changes DNS, feature flags, SQL migrations, data backfills, certificates/keys, provider-managed credentials, rollback or cleanup steps, or other manual operator actions. Use `Service Impact` for expected user, operator, release, security, performance, data, or compatibility effects. If there is no user-facing or operational impact, say that explicitly.

Use `Operational Checklist` for manual actions required before deployment, during deployment, or after deployment outside the code change. Include environment variables or secrets added, removed, renamed, or no longer read in deployment platforms and secret stores; setup, login, configuration, or cleanup in third-party integration dashboards; webhook, cron, and queue providers; DNS changes; feature flags; SQL migrations; data backfills; secret rotation; certificate/key changes; provider-managed credentials; manual verification in provider dashboards; and rollback or cleanup steps. Name required manual actions in platform-agnostic terms and include likely affected systems. Keep this section as a checklist. If no manual operational action is required, include the no-action item only after the external operations impact scan finds no required manual action:

```markdown
- [x] No manual operational actions required.
```

Include a test plan checklist even when verification was not run; mark unchecked items honestly.

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
- The session does not identify exactly one MDF task when a task handoff is needed outside MDF init setup PR mode.
- The selected task file is missing or malformed, the incomplete task is not `active`, or the completed-task path lacks matching persisted `worktree` and `branch` values.
- The incomplete task's lock file is missing, unreadable, or malformed, or a completed task has an inconsistent matching lock.
- Session task context conflicts with current worktree or branch.
- The GitHub CLI is unavailable or not authenticated.
- The repository does not have an `origin` remote.
- The remote base branch cannot be resolved or fetched.
- The current branch does not merge cleanly into the remote base branch.
- Release signal is required and unclear.
- Pushing the branch fails.
- `gh pr create` fails.

## Boundaries

This skill may complete the current session's incomplete MDF task when the guard passes, but it must use the `task` skill completion behavior rather than editing task files directly. It may hand off an already-completed task after validating its persisted `worktree` and `branch`, without invoking `task done` or mutating task state. This skill may bypass task completion only in MDF init setup PR mode delegated by `init`. This skill may use `github-commit` before PR creation when uncommitted changes exist.

When invoked, push the current branch to `origin` and create a ready-for-review GitHub PR with `gh pr create`. If an open PR already exists for the current branch, report its URL instead of creating a duplicate. Do not require a second explicit confirmation for PR creation.

After the PR is created or reported, stop. PR review, CI, merge, default-branch sync, and stale worktree cleanup happen later. Once the user says the PR has been merged, use `github-after-merge` to verify the merge, return the canonical checkout to the default branch, fast-forward it, and then use `github-clear-gone` for confirmed branch/worktree cleanup.
