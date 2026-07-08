# Midnight Forge

Midnight Forge (`mdf`) is a Codex plugin harness for solo developers. It combines local MDF task workflows with a generated skill surface built from vendored `agent-skills` plus MDF overlays.

## Scope

- Product name: `midnight-forge`
- Plugin namespace: `mdf`
- Supported runtime: Codex
- Runtime surface: generated root `skills/`, `references/`, and `agents/`
- Source inputs: `vendor/agent-skills`, `overlays/mdf`, and sync/validation scripts
- Local task state: canonical project-root `.mdf/`, gitignored

Claude Code plugin support has been intentionally removed. Do not recreate `.claude-plugin/` or `commands/` shims unless the product direction changes explicitly.

## Install

Install the released plugin through the GitHub-hosted Codex marketplace:

```bash
codex plugin marketplace add jjlabsio/midnight-forge
```

Then open the Codex Plugin Directory, select the `Midnight Forge` marketplace, and install or enable `mdf`.

## Use

Initialize MDF before task or workflow commands:

```text
$init
```

Common entrypoints:

```text
$task add "Write the release checklist"
$task work 001
$tasks-project
$tasks-user
$auto-workflow
$spec
$plan
$build
$test
$review
$code-simplify
$ship
```

## Architecture

Midnight Forge commits complete generated runtime files so Codex can read ordinary skill files during task execution. The source layout is:

```text
vendor/agent-skills/          # pinned upstream source
overlays/mdf/                 # MDF overlay inputs
scripts/sync-agent-skills.js  # generated surface renderer
skills/ references/ agents/   # generated runtime surface
```

See [docs/architecture/agent-skills-overlay-system.md](docs/architecture/agent-skills-overlay-system.md) for the full overlay model.

## Work Items

MDF task state and workflow artifacts are local by default:

```text
<canonical-project-root>/.mdf/
  project.json
  project/init.json
  index.jsonl
  work/
  locks/
```

Linked worktrees under `<canonical-project-root>/.worktrees/<branch>` use the canonical root `.mdf/` directory. Workflow artifacts stay under `.mdf/work/{work_id}/` unless the user explicitly promotes a document into tracked project docs.

See [docs/architecture/mdf-task-system.md](docs/architecture/mdf-task-system.md) for the task storage model.

## Documentation

Tracked project docs live under [docs/](docs/index.md). The docs taxonomy separates product context, architecture, durable decisions, and operations. Local workflow artifacts remain under `.mdf/work/{work_id}/`.

## Validation

Run the generated surface checks before PRs:

```bash
node scripts/sync-agent-skills.js --dry-run
node scripts/validate-agent-skills-sync.js
node scripts/validate-agent-skills-port.js
```
