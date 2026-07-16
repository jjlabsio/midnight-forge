# Agent Skills Overlay System

## Purpose

Midnight Forge preserves the pinned `agent-skills` source while keeping
MDF-specific skill and packaging inputs outside the upstream snapshot. The
repository commits complete generated `skills/`, `references/`, and `agents/`
files so Codex can read ordinary files during execution.

## Source layout

```text
vendor/agent-skills/                 # pinned immutable upstream source
vendor/agent-skills.lock.json        # upstream repository and commit
overlays/mdf/inventory.json          # inventory root and shard list
overlays/mdf/inventory/              # generated output inventory shards
overlays/mdf/release-metadata.json   # release source
overlays/mdf/                        # MDF overlay inputs
scripts/sync-agent-skills.js         # packaging renderer
scripts/validate-agent-skills-*.js  # packaging validators
skills/ references/ agents/          # generated runtime surface
```

Each inventory entry records its output, source or overlay input, hash when
applicable, classification, and packaging rationale. Entries may also declare
`contractRefs` for shared generated references; the packaging validator resolves
those IDs through the inventory root's `contracts` registry. Maintained
surfaces are classified as active, historical, or packaging in the task-0041
inventory.

## Sync and validation

The sync renderer reads inventory shards, cleans generated targets, copies
pinned upstream files or MDF overlay inputs, applies release metadata, and
writes complete generated files. Edit overlay inputs first; do not hand-edit a
generated root file. Dry-run mode compares the result byte-for-byte.

The retained validators check inventory schema and path safety, pinned source
hashes, generated coverage, source/overlay equality, release metadata, the
declared contract-reference graph, and dry-run sync. They are packaging checks.
They do not decide task readiness, approval, review meaning, lifecycle
progress, recovery, or ship success.

## Model-led workflow boundary

Public MDF skills are readable workflow guidance over the upstream primitives.
The model owns semantic routing, task interpretation, exact artifact approval,
review meaning, downstream impact, recovery choice, and external authority.
Canonical `.mdf` cards, rebuildable index projections (append-only for normal
lifecycle writes), locks, and project-local worktrees remain preserved
contracts. Task and board skills own automatic self-healing of that derived
projection from authoritative cards and locks.

The model-led workflow keeps only the existing task-state primitives needed by
the repository. Auto-workflow does not add a policy module, JSON protocol, or
runtime verifier. The root model reads the applicable Markdown contracts and
ordinary Git/MDF state, makes semantic decisions, and records readable
handoff, dispatch, and fallback notes.

When the caller explicitly establishes `mode: auto-workflow`, the run-scoped
contract grants the root authority to complete in-scope local MDF skills and
to commit plan slices, but not to ship, complete the whole task, push, or
create/update a PR. `mode: auto-workflow-pr` is the separate delivery mode:
after its final preflight and ship GO, it may complete the whole task, push,
and create/update the PR. A mode string alone is not authority; the current
handoff, task/lock/worktree/branch facts, approved artifact hashes, and fresh
preflight are required. Neither mode alters standalone skill semantics.
Merge, deploy, deletion, stale-lock takeover, unrelated cleanup, and
unresolved critical decisions remain outside the grant.

Everything else is performed by the model and ordinary project commands with
explicit confirmation where a write is destructive or external. Historical
workflow artifacts remain readable even when their old producer has been
removed.

## Upstream boundary

`vendor/agent-skills` remains immutable. MDF-only replacements are explicit
inventory inputs, and generated output is the installed surface. Protected
upstream skills, references, personas, and guides stay byte-identical to the
pinned source. MDF entry skills may adapt an upstream command into a Codex
skill, but the adaptation is model guidance and does not redefine upstream
success criteria.

### Upstream update boundary

The repository-local `.agents/skills/update-agent-skills-upstream/SKILL.md`
skill updates the vendor snapshot before it touches generated output. It
belongs to the project rather than the MDF plugin. It compares the complete
`skills/**`, `references/**`, `commands/**`, `agents/**`, and `hooks/**` trees,
including skill-local scripts and newly added files. Upstream root scripts and
ordinary docs remain preserved and reportable but are explicit runtime-import
exclusions; imported references to them fail closed. Hooks remain preserved in
the vendor tree and require a separate Codex-native event/payload/output/trust
port record before they can be considered available.

Each update records the previous and target commits, classifies additions,
deletions, modifications, and renames, refreshes source hashes and inventory,
regenerates the complete surface, and stores a categorized report. This keeps
upstream-owned bytes, MDF-only inputs, adapter decisions, generated files, and
unresolved port gaps distinct.

## Release metadata

Plugin manifests are generated output. The release version and marketplace ref
come from `overlays/mdf/release-metadata.json`; sync renders them into
`.codex-plugin/plugin.json` and `.agents/plugins/marketplace.json`. Run sync
and both packaging validators before committing a release.

## Tradeoffs

- Generated files duplicate source-derived content, but normal Codex execution
  stays simple.
- Sharded inventory files add one load step, but surface ownership is easier to
  review.
- Model-led routing is more flexible than a large scripted state machine, at
  the cost of requiring clear readable stop conditions and human judgment.
