---
name: init
description: "Initialize MDF user and project state, including explicit human language preference and local workflow-state ignore policy."
---

# init

Use this skill when the user invokes `$init` in Codex, `mdf init`, or asks to initialize MDF.

Semantic setup questions in this skill remain LLM-driven. Deterministic local
state validation and application may use the independent JSON script described
below; do not use an MCP server, background runner, event store, or network
service.

## Deterministic Script Boundary

After resolving the installed plugin root, the orchestrator may invoke
`scripts/mdf-init.js` from that plugin root with one JSON operation at a time:

- `validate`: inspect user/project schemas, canonical layout, and ignore-policy
  status without creating state.
- `apply`: apply only explicit bootstrap input such as `human_language`, write
  canonical state atomically, and preserve unrelated registry entries.

The script must run only after the skill has handled the semantic setup
questions. It never infers a human language, edits `.gitignore`, creates a
setup branch/commit/PR, chooses docs or agent-rule changes, or performs a
tracked project setup decision. Missing ignore coverage and malformed state
are typed stops; do not continue from a partial result.

`mdf init` is the only MDF skill that creates or repairs MDF setup state. Other MDF state-boundary skills must verify init state and stop with instructions to run `mdf init` when init is missing.

## Phases

Run phases in this order:

1. User Init
2. Project Init, only when the current directory is inside a project

Keep these phases clearly separated in user-facing output and in any saved notes so they can become separate commands later.

## User Init

User init owns global MDF state under the user's home directory:

```text
~/.mdf/
~/.mdf/user/
~/.mdf/user/init.json
~/.mdf/user/preferences.json
~/.mdf/projects.json
```

Steps:

1. Create `~/.mdf/` when missing.
2. Create `~/.mdf/user/` when missing.
3. Create or verify `~/.mdf/user/preferences.json`.
4. Require an explicit `human_language` preference in `preferences.json`.
5. Create or verify `~/.mdf/user/init.json`.
6. Create or verify `~/.mdf/projects.json`.

`preferences.json` must use this schema:

```json
{
  "version": 1,
  "human_language": "English"
}
```

Do not infer `human_language` from terse command tokens, task IDs, branch names, file paths, or command shorthands. If the user has not explicitly provided a human language in the current instruction or an existing valid preferences file, ask one short question before writing `preferences.json`.

`init.json` must use this schema:

```json
{
  "version": 1,
  "initialized_at": "2026-06-08T00:00:00Z",
  "runtime": "codex"
}
```

`projects.json` must use this schema:

```json
{
  "version": 1,
  "projects": {}
}
```

If an existing user file is malformed or does not match the documented schema, stop and report the exact file and schema problem. Do not overwrite malformed user state without explicit instruction.

## Project Init

Run project init only when the current directory is inside a project. A project is any git repository or any non-git directory where the user explicitly asks MDF to initialize project state.

Resolve the canonical project root from the first available source:

1. If the current checkout path is under `<root>/.worktrees/<branch>`, use `<root>`.
2. Otherwise use `git rev-parse --show-toplevel`.
3. If not inside a git repository and the user explicitly asked for project init, use the absolute current working directory.

Project init owns project-local MDF state under the canonical root:

```text
<canonical-root>/.mdf/
<canonical-root>/.mdf/project.json
<canonical-root>/.mdf/project/init.json
<canonical-root>/.mdf/index.jsonl
<canonical-root>/.mdf/work/
<canonical-root>/.mdf/locks/
```

Do not create an independent `.mdf/` directory inside a linked worktree. A linked worktree under `<canonical-root>/.worktrees/<branch>` reads and writes the canonical root `.mdf/` store.

### Ignore Policy

Before creating or writing project `.mdf/` inside a git repository, verify that both local workflow-state paths are ignored:

```bash
git check-ignore -q "<canonical-root>/.mdf/"
git check-ignore -q "<canonical-root>/.worktrees/"
```

Use directory-form paths with trailing slashes so entries such as `.mdf/` and `.worktrees/` are recognized even before the directories exist.

If either `.mdf/` or `.worktrees/` is not ignored:

1. Do not create or write project `.mdf/`.
2. Show which entries are missing from ignore coverage.
3. Inspect the tracked docs and agent-rule conventions before asking setup questions:
   - Docs policy files and indexes: `docs/AGENTS.md`, `docs/CLAUDE.md`, `AGENTS.md`, `CLAUDE.md`, `docs/index.md`, and root `README.md`.
   - Docs structure: existing product, architecture, decisions, and operations docs directories, including project-specific equivalents.
   - Agent rules: existing `AGENTS.md`, `CLAUDE.md`, `docs/AGENTS.md`, `docs/CLAUDE.md`, or another clearly established project convention.
4. Ask whether to create one setup branch that handles both local workflow-state ignore entries, and whether to open a setup PR after committing.
5. If the project has no docs directory or no clear equivalent product, architecture, decisions, and operations docs structure, ask whether to include the basic docs structure in the same setup PR:

   ```text
   This project does not yet have a clear docs structure for MDF design and decision records.
   Should the setup PR also add the basic docs structure MDF will use?

   Files to add:
   - docs/index.md
   - docs/product/index.md
   - docs/product/product-brief.md
   - docs/architecture/index.md
   - docs/decisions/index.md
   - docs/operations/index.md
   ```

   Use `index.md` files for this structure. Do not add placeholder `README.md` files for these docs areas. Treat `docs/product/product-brief.md` as the lightweight default product context document for startup, solo-founder, and product-led projects. Do not create `docs/product/service-definition.md` by default; it is an optional extension for service-heavy, platform-oriented, B2B/enterprise, or operationally mature projects. If equivalent product, architecture, decisions, or operations directories already exist, do not create duplicate MDF fallback directories; preserve the existing convention instead.
6. Ask whether the setup PR should add or update a project agent rules file with a documentation rule:
   - Before asking, inspect existing agent rules for an equivalent instruction to check relevant project docs before starting code or design changes.
   - Treat equivalent meaning as enough to skip, even when wording differs from MDF's suggested snippet.
   - Do not require MDF marker comments or exact MDF wording to recognize an existing equivalent rule.
   - If an equivalent unmarked or human-authored docs-before-work rule already exists, skip the agent-rules setup question and preserve the file unchanged.
   - If no agent rules file exists, ask whether to add `AGENTS.md`.
   - If `AGENTS.md`, `CLAUDE.md`, `docs/AGENTS.md`, `docs/CLAUDE.md`, or another clear convention exists and no equivalent unmarked or human-authored docs-before-work rule exists, ask whether to update that existing file instead of creating a duplicate.
   - If updating an existing file, preserve its style and unrelated content.
   - The rule must require agents to check relevant project docs before starting code or design changes.
   - When MDF adds a new docs-before-work rule, wrap the inserted block in `<!-- MDF:BEGIN context-check -->` and `<!-- MDF:END context-check -->`.
   - If an MDF-managed context-check block already exists, update only that block while preserving unrelated content.

   Suggested rule for `AGENTS.md` when no stronger project convention exists:

   ```markdown
   <!-- MDF:BEGIN context-check -->
   ## Project Documentation

   Before making code or design changes, check the relevant project documentation first.

   Start with `docs/index.md`, then read any related documents under:
   - `docs/product/` for product context, scope, users, workflows, and success signals
   - `docs/architecture/` for system design and structural decisions
   - `docs/decisions/` for accepted or superseded decision records
   - `docs/operations/` for deployment, rollback, runbook, and operational guidance

   When adding, moving, or deleting tracked docs, update `docs/index.md` and the relevant area `index.md` in the same change.
   <!-- MDF:END context-check -->
   ```

   Adapt paths only when the project already has equivalent docs paths. Keep generated prompt text, docs templates, and agent-rule snippets in English.
7. If the user agrees, stop first if the current checkout has uncommitted changes.
8. Perform setup from the normal repository checkout, not from a task worktree.
9. Create a branch named `chore/mdf-init-local-state`, or a similarly clear unique branch if that branch already exists.
10. Add only the user-approved setup changes:
   - Missing `.mdf/` and `.worktrees/` entries in `.gitignore`, preserving unrelated rules. Create `.gitignore` if the repository does not have one.
   - The basic docs structure only when the user approved it and no equivalent project convention exists.
   - The agent rules addition or update only when the user approved it, no equivalent unmarked or human-authored docs-before-work rule already exists, and the change preserves existing style and unrelated content.
   - MDF-created docs-before-work blocks must use `<!-- MDF:BEGIN context-check -->` and `<!-- MDF:END context-check -->`; marker-free human-authored equivalent rules must still be respected and not duplicated.
11. Commit with `chore: set up MDF project workflow state`.
12. If the user agreed to open a PR, invoke the `github-pr` skill's MDF init setup PR mode from the setup branch after the setup commit exists. Provide this setup PR intent to `github-pr`: title `chore: set up MDF project workflow state`, no-release behavior through `release-none`, and body context explaining that MDF setup cannot continue until the setup PR is merged.
13. Stop after reporting the setup branch, commit, and the PR result returned by `github-pr` when available. The user should rerun `mdf init` after the setup PR is merged.

This is the only MDF setup branch, `.gitignore` edit, optional basic docs structure creation, optional agent-rules setup, setup commit, or setup PR delegation flow for MDF project setup. Other MDF skills must not create tracked docs, agent rules, setup branches, setup commits, or setup PRs. Setup PR push/create/update mechanics belong to `github-pr`, not `init`.

### Optional Docs And Agent Rules Setup

After ignore policy passes, inspect the tracked docs and agent-rule conventions before creating or updating project `.mdf/` state:

- Docs policy files and indexes: `docs/AGENTS.md`, `docs/CLAUDE.md`, `AGENTS.md`, `CLAUDE.md`, `docs/index.md`, and root `README.md`.
- Docs structure: existing product, architecture, decisions, and operations docs directories, including project-specific equivalents.
- Agent rules: existing `AGENTS.md`, `CLAUDE.md`, `docs/AGENTS.md`, `docs/CLAUDE.md`, or another clearly established project convention.

If the project has no docs directory or no clear equivalent product, architecture, decisions, and operations docs structure, ask whether to create a setup branch and PR for the basic docs structure using the same prompt and file list from the ignore-policy setup flow.

Independently inspect agent rules. Before asking about agent-rules setup, inspect existing `AGENTS.md`, `CLAUDE.md`, `docs/AGENTS.md`, `docs/CLAUDE.md`, or another clear project agent rules convention for an equivalent instruction to check relevant project docs before starting code or design changes. Treat equivalent meaning as enough to skip, even when wording differs from MDF's suggested snippet, and do not require MDF marker comments or exact MDF wording to recognize an existing equivalent rule. If an equivalent unmarked or human-authored docs-before-work rule already exists, skip the agent-rules setup question and preserve the file unchanged.

If no equivalent unmarked or human-authored docs-before-work rule exists and no agent rules file exists, ask whether to create a setup branch and PR that adds `AGENTS.md` with the project documentation rule. If no equivalent unmarked or human-authored docs-before-work rule exists and an agent rules file already exists, ask whether to create a setup branch and PR that updates the existing convention instead. This agent-rules setup question applies even when the project already has a clear docs structure.

When MDF adds a new docs-before-work rule, wrap the inserted block in `<!-- MDF:BEGIN context-check -->` and `<!-- MDF:END context-check -->`. If an MDF-managed context-check block already exists, update only that block while preserving unrelated content. Marker-free human-authored equivalent rules must still be respected and not duplicated; MDF-managed context-check blocks remain updateable within the marker boundary.

Only create a setup branch when the user approves at least one tracked docs or agent-rule change. If the user approves a setup branch:

1. Stop first if the current checkout has uncommitted changes.
2. Perform setup from the normal repository checkout, not from a task worktree.
3. Create a branch named `chore/mdf-init-docs`, or a similarly clear unique branch if that branch already exists.
4. Add only the user-approved docs structure and agent-rule changes, preserving existing conventions and unrelated content.
   - Add or update agent rules only when no equivalent unmarked or human-authored docs-before-work rule already exists.
   - Use MDF context-check markers for MDF-created docs-before-work blocks and update only the existing MDF-managed block when present.
5. Commit with `chore: set up MDF project documentation`.
6. If the user agreed to open a PR, invoke the `github-pr` skill's MDF init setup PR mode from the setup branch after the setup commit exists. Provide this setup PR intent to `github-pr`: title `chore: set up MDF project documentation`, no-release behavior through `release-none`, and body context explaining that MDF setup cannot continue until the setup PR is merged.
7. Stop after reporting the setup branch, commit, and the PR result returned by `github-pr` when available. The user should rerun `mdf init` after the setup PR is merged.

If the user declines tracked docs and agent-rule setup, or the project already has clear equivalent conventions, continue normal project init.

### Project Files

After ignore policy passes, create any missing project layout:

```text
<canonical-root>/.mdf/
<canonical-root>/.mdf/work/
<canonical-root>/.mdf/locks/
<canonical-root>/.mdf/project/
```

`project.json` must use this schema:

```json
{
  "name": "project-basename",
  "canonical_root": "/absolute/project/root",
  "remote": "git@github.com:user/project.git",
  "created": "2026-06-08T00:00:00Z"
}
```

Use the canonical root basename for `name`. Include `remote` when an origin remote exists; otherwise set it to `null`.

`project/init.json` must use this schema:

```json
{
  "version": 1,
  "initialized_at": "2026-06-08T00:00:00Z",
  "runtime": "codex",
  "canonical_root": "/absolute/project/root"
}
```

Create `index.jsonl` as an empty file when missing. Do not overwrite existing task state.

Upsert the project into `~/.mdf/projects.json`:

```json
{
  "version": 1,
  "projects": {
    "/absolute/project/root": {
      "id": "1d55c7f13adf",
      "name": "project-basename",
      "canonical_root": "/absolute/project/root",
      "remote": "git@github.com:user/project.git",
      "index": ".mdf/index.jsonl",
      "last_seen": "2026-06-08T00:00:00Z"
    }
  }
}
```

Use `projects[canonical_root]` as the upsert target and preserve unrelated project entries. Set `id` to the first 12 lowercase hex characters of SHA-256 over `remote` when present, otherwise over `canonical_root`.

If an existing project file is malformed or does not match the documented schema, stop and report the exact file and schema problem. Do not overwrite malformed project state without explicit instruction.

## Init Verification For Other Skills

State-boundary skills that read or write MDF user/project/work state must verify the relevant init markers before accessing that state:

- User state requires `~/.mdf/user/init.json` and `~/.mdf/user/preferences.json` with a non-empty `human_language`.
- Project state requires `<canonical-root>/.mdf/project/init.json` and the canonical project layout.
- Work item state requires project state first.

When init is missing, the skill must stop and say which command to run:

```text
Run mdf init before using this MDF workflow.
```

Do not auto-initialize from another skill.

## Human-Facing Language

After user init succeeds, human-facing prose should follow `~/.mdf/user/preferences.json` `human_language`.

Preserve fixed workflow contracts exactly as written. Do not translate MDF schema keys, YAML frontmatter keys, task status values, file paths, commands, code identifiers, branch names, release labels, required template headings, Conventional Commit type/scope prefixes, or repository-required conventions.

## Completion

Report:

- User Init: created, verified, or blocked
- Project Init: created, verified, skipped, or blocked
- `human_language`
- Canonical project root when project init ran
- Any setup branch, commit, PR, or reason setup stopped
