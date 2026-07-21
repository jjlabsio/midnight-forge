---
name: github-commit
description: "Create one focused Git commit for MDF work."
---

# GitHub Commit

When saving commit metadata for MDF continuity, verify MDF user and project init state, resolve the current MDF work item, and write `.mdf/work/{work_id}/commit-NNN.md`. If init state is missing, stop and instruct the user to run `mdf init`. This does not replace the actual git commit; it records commit hash, message, and relevant verification evidence.

## Overview

Create one git commit for the current work, based on the simple `commit-commands` workflow.

## Context To Read

Before committing, inspect:

```bash
git status
git diff HEAD
git branch --show-current
git log --oneline -10
```

## Workflow

1. Confirm there are staged or unstaged changes.
2. Review the diff and recent commit messages to match the repository style.
3. Do not commit secrets or local-only environment files such as `.env`, `.env.local`, credentials, tokens, or private keys.
4. Stage the relevant files.
5. Create a single commit with an appropriate message.
6. Report the commit hash and message.

## Boundaries

Do not push. Do not create a PR. Use `github-pr` for PR preparation and creation.

Stop if the diff contains suspicious secrets or if the requested commit scope is ambiguous.
