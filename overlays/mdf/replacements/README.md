# Midnight Forge

Midnight Forge (`mdf`) is a Codex plugin harness for solo developers. It keeps
the pinned `agent-skills` primitives byte-identical while adding readable MDF
skills for canonical task state, approvals, worktree isolation, review, and
GitHub handoff.

## Scope

- Product name: `midnight-forge`
- Plugin namespace: `mdf`
- Supported runtime: Codex
- Runtime surface: generated `skills/`, `references/`, and `agents/`
- Source inputs: `vendor/agent-skills`, `overlays/mdf`, and packaging scripts
- Local task state: canonical project-root `.mdf/`, gitignored

Claude Code plugin support has been intentionally removed. Do not recreate
`.claude-plugin/` or `commands/` shims unless product direction changes
explicitly.

## Install

```bash
codex plugin marketplace add jjlabsio/midnight-forge
```

Then open the Codex Plugin Directory, select the `Midnight Forge` marketplace,
and install or enable `mdf`.

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
$auto-workflow-pr
$quick-workflow-pr
$spec
$plan
$build
$test
$review
$code-simplify
$ship
$webperf
```

Each workflow is model-led. Skills resolve the canonical root, read Markdown
cards and artifacts, explain ambiguity, and stop for current human or
external confirmation. No broad workflow runtime owns routing or semantic
success. The narrow lock helper, when used, only inspects, exclusively
acquires, and byte-conditionally releases a lock.

`$auto-workflow` runs the repeatable local implementation loop through review,
code simplification, and commit. It keeps the whole MDF task active and does
not ship, push, or create a PR. `$auto-workflow-pr` is the delivery workflow:
it resumes valid local work, uses the full spec as its acceptance baseline,
ships, completes the whole task after ship GO, and then pushes and creates or
updates the PR. `$quick-workflow-pr` is the explicit lightweight delivery
workflow for small documentation or implementation changes: it always skips
spec and plan, reuses the canonical build/review/GitHub PR skills, loops back
to build for actionable review findings, and does not invoke ship or
code-simplify. Plan-slice completion and whole-task completion are distinct.

## Architecture

The repository commits complete generated files so Codex can read ordinary
skill files during execution. The source layout is:

```text
vendor/agent-skills/          # pinned immutable upstream source
overlays/mdf/                 # MDF skill and packaging inputs
overlays/mdf/inventory/       # generated-surface inventory shards
scripts/sync-agent-skills.js  # packaging renderer
skills/ references/ agents/   # generated runtime surface
```

Edit overlay inputs and regenerate root outputs with the sync renderer. The
vendor snapshot is immutable. The retained validators check source hashes,
inventory coverage, generated output, and overlay/source equality; they do not
enforce workflow lifecycle or review meaning.

See [docs/architecture/agent-skills-overlay-system.md](docs/architecture/agent-skills-overlay-system.md)
and [docs/architecture/mdf-task-system.md](docs/architecture/mdf-task-system.md).

## Work Items

MDF task state and readable workflow artifacts are local by default:

```text
<canonical-project-root>/.mdf/
  project.json
  project/init.json
  index.jsonl
  work/
  locks/
```

Linked worktrees under `<canonical-project-root>/.worktrees/<branch>` use the
canonical root `.mdf/` directory and never create independent state. `item.md`
is the card source of truth; `index.jsonl` is a rebuildable board projection.
Normal task mutations append a current-schema projection, while task and board
skills automatically normalize known legacy rows and compact the index when
cards and locks make the result unambiguous. Locks are ownership markers, not
semantic authorization.

## Validation

Run the packaging checks before PRs:

```bash
node scripts/sync-agent-skills.js --dry-run
node scripts/validate-agent-skills-sync.js
node scripts/validate-agent-skills-port.js
```

Historical `.mdf/work/` artifacts remain readable and are not rewritten by
packaging checks. See [docs/architecture/mdf-mechanization-inventory-0041.md](docs/architecture/mdf-mechanization-inventory-0041.md)
for the maintained, historical, and packaging surface inventory.
