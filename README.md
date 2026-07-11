# Midnight Forge

Midnight Forge (`mdf`) is a Codex plugin harness for solo developers. It keeps
agent-skills workflow primitives byte-identical to their pinned upstream source
and adds MDF-only controllers for canonical task artifacts and Codex runtime
orchestration.

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
$webperf
```

## Architecture

Midnight Forge commits complete generated runtime files so Codex can read ordinary skill files during task execution. The source layout is:

```text
vendor/agent-skills/          # pinned upstream source
overlays/mdf/                 # MDF controller and packaging inputs
overlays/mdf/release-metadata.json
scripts/sync-agent-skills.js  # generated surface renderer
skills/ references/ agents/   # generated runtime surface
```

See [docs/architecture/agent-skills-overlay-system.md](docs/architecture/agent-skills-overlay-system.md) for the full overlay model.

Public skill files are thin entrypoints over a production controller runtime in
`scripts/controller-runtime/`. That runtime binds lifecycle decisions to exact
canonical artifacts and current Git evidence while preserving upstream workflow
behavior and raw results. The architecture document is the source of truth for
the sidecar trust boundary and MDF's intentional automation and same-task
simplification exceptions.

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
node scripts/validate-mdf-controller-runtime.js
node scripts/validate-mdf-task-state-cli.js
```
