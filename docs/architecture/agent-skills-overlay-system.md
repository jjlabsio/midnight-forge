# Agent Skills Overlay System

## Purpose

Midnight Forge preserves upstream `agent-skills` source while keeping MDF-specific behavior outside that upstream snapshot. The repository commits complete generated runtime files so Codex and future agents can read ordinary `skills/`, `references/`, and `agents/` files during execution.

## Source Layout

```text
vendor/agent-skills/                 # pinned immutable upstream source
vendor/agent-skills.lock.json        # upstream repository and commit
overlays/mdf/inventory.json          # root overlay manifest and shard file list
overlays/mdf/inventory/              # generated output inventory shards
overlays/mdf/release-metadata.json   # plugin version and marketplace release ref source
overlays/mdf/                        # MDF overlay inputs
scripts/sync-agent-skills.js         # renderer
scripts/validate-agent-skills-sync.js
scripts/validate-agent-skills-port.js
scripts/mdf-controller.js            # production lifecycle CLI
scripts/controller-runtime/          # production enforcement modules
skills/ references/ agents/          # generated runtime surface
```

## Overlay Kinds

`overlays/mdf/inventory.json` stores global overlay metadata:

- `schemaVersion`
- pinned upstream repository and commit
- generated clean targets
- excluded upstream files
- ordered `generated.entryFiles` shard references
- overlay v2 policy metadata

Each file under `overlays/mdf/inventory/` records generated output entries for one reviewable surface. Skill entries live in `overlays/mdf/inventory/skills/{skill}.json` so a reviewer can inspect a specific skill's upstream relationship without scanning one large manifest. Non-skill generated outputs use namespace shards such as `agents/`, `references/`, `commands/`, and `packaging/` instead of being forced into a skill-only model.

Each generated output entry records one overlay kind. Protected upstream
primitives, personas, guides, and security references use only `copy`:

- `copy`: copy a pinned upstream file.
- `mdfOnly`: copy an MDF-native file with no upstream source.
- `mdfOnly`: render a controller, task, packaging, or adapter file that has no
  upstream counterpart.
- `renameAdapter`: expose an MDF public controller for a command name.

Semantic fragment, patch, and source-backed replacement entries are not valid
in the current generated-surface contract. The port validator owns the explicit
immutable equality matrix and rejects preserved upstream drift.

## Sync Flow

1. Read `overlays/mdf/inventory.json`.
2. Load each `generated.entryFiles` shard and combine the entries in manifest order.
3. Clean generated output targets.
4. For each entry, read the pinned upstream source or MDF overlay source.
5. Verify base hashes when present.
6. Render the declared copy or MDF-owned controller.
7. Write complete generated files to root `skills/`, `references/`, `agents/`, manifests, and README.

Dry-run mode renders to a temporary directory and byte-compares the result against checked-in generated output.

## Validation Flow

`scripts/validate-agent-skills-sync.js` checks inventory schema, shard path
safety, duplicate shard references, duplicate outputs, unsafe paths, generated
coverage, and generated path references. `scripts/validate-agent-skills-port.js`
enforces byte equality for the protected matrix, deletes evaluator surfaces,
and exercises controller contracts for approvals, build modes, review freshness,
DDD parity, persona loading, and one-writer orchestration.

## Runtime and Controller Policy

MDF never injects artifact storage or lifecycle behavior into upstream
primitives. Generated public skills are thin entrypoints: they select the exact
applicable upstream primitive, while lifecycle permission, evidence validation,
and next-action selection come from `scripts/mdf-controller.js` and the modules
under `scripts/controller-runtime/`. The runtime exercised by validators is the
same production runtime used by these entrypoints; there is no validator-only
state-machine model.

MDF controllers apply canonical artifact storage under:

```text
<canonical-root>/.mdf/work/{work_id}/{artifact-type}-NNN.md
```

Controllers record spec and plan approval against the exact canonical artifact
revision/hash and invalidate it on revision. They resolve skill, persona,
reference, documentation, and supporting-script paths from the installed plugin
root, not the user project's working directory or a fixed cache path.

The production runtime owns context resolution, append-only evidence sidecars,
adapter handshakes, typed lifecycle edges, task and whole-build gates, bounded
recovery, technical revision invalidation, simplification, standalone review,
ship, and the terminal `github-pr` handoff. Existing upstream skills remain
authoritative for how implementation, review, simplification, shipping, and PR
creation are performed. The handoff never reimplements commit, push, or
pull-request mechanics.

## Controller Responsibility Boundary

The controller is a mechanical enforcement layer, not a second implementation
of the upstream engineering workflows. The root agent loads and follows the
exact applicable upstream skill, performs semantic judgment, and produces the
raw result. The controller verifies whether that execution may be recorded or
advance the MDF lifecycle.

The controller owns facts that deterministic code can establish:

- canonical artifact and input identities, hashes, and current Git tree;
- actual command argv, exit code, output bytes, and worktree binding;
- declared verification-matrix completeness where a plan defines a matrix;
- task-owned path scope, clean baselines, focused commit facts, and one-writer
  state;
- executor/persona capability provenance, freshness claims, lifecycle edges,
  replay protection, and explicit human authority.

The upstream skill and the agent executing it own semantic adequacy:

- whether a test expresses the intended behavior and constitutes a meaningful
  RED/GREEN TDD cycle;
- whether a project-specific command is the appropriate full suite or build;
- whether a review finding, simplification candidate, diagnosis, or ship
  judgment is technically correct;
- which applicable upstream supporting skill is required for the current
  decision.

The controller must not infer those meanings from command names, exit-code
patterns, Markdown headings, report phrases, or tool-specific allowlists. Such
parsing would create a partial MDF reimplementation of the upstream workflow and
would be validator theater rather than proof. Sidecars bind the responsible
agent's decision to exact inputs; they do not make that semantic decision a
deterministic fact.

Review this boundary accordingly. A real controller finding requires at least
one of the following: an applicable upstream primitive is skipped or weakened by
the public MDF entrypoint; caller-asserted mechanical facts can replace runtime
observation; provenance, freshness, scope, or lifecycle checks can be bypassed;
or a declared deterministic matrix can advance while incomplete. The mere fact
that a malicious or non-compliant root could choose a meaningless test command
is not a controller defect when the public entrypoint still requires the exact
upstream workflow and the runtime truthfully records what ran.

## Evidence Trust Boundary

Canonical project files and the in-process production runtime are trusted to
write MDF state. CLI JSON, external command output, user or subagent artifacts,
raw review reports, external GitHub observations, and old or replayed sidecars
are untrusted inputs. The runtime computes mechanical Git and file facts,
binds semantic decisions to exact input bytes and invocation provenance, and
rejects stale, malformed, replayed, or fabricated evidence. It preserves raw
upstream output and never parses natural-language reports to manufacture a pass.

Sidecars prove which bytes, tree, executor, capability, and decision were used;
they do not claim that an agent's semantic judgment is mechanically true. Human
authority such as initial approvals, risk acceptance, or PR mutation permission
must be explicit and bound to the corresponding user-message artifact.

## Intentional MDF Workflow Exceptions

MDF preserves upstream workflow intent and result contracts, with two explicit
composition exceptions for the harness:

- After exact spec and plan approval, `auto-workflow` may continue through
  obvious, reproducible, reversible, spec-covered technical repair without
  pausing at every ordinary agent decision. It still stops for changed intent,
  ambiguity, high-risk or irreversible judgment, no progress, risk acceptance,
  ship NO-GO, and GitHub or PR ambiguity.
- Code simplification stays inside the same MDF task and feature PR after a
  stable whole-build baseline. It is isolated in candidate-scoped verification
  and `refactor:` commits. Changed code must pass whole-build verification and
  fresh review again before ship. A verified no-change result reuses the exact
  final-tree whole-build review; standalone `review` remains independently
  callable rather than being repeated by `auto-workflow`.

These exceptions change orchestration timing, not the internal rules or output
shape of an upstream primitive.

## Release Metadata

Plugin manifests are generated output. The release version and marketplace ref come from `overlays/mdf/release-metadata.json`; sync renders those values into `.codex-plugin/plugin.json` and `.agents/plugins/marketplace.json`.

The release workflow updates `overlays/mdf/release-metadata.json`, runs `node scripts/sync-agent-skills.js`, and then runs the generated-surface validators before committing the release. Do not update root generated manifests as the independent source of truth.

## Tradeoffs

- Generated runtime files duplicate source-derived content, but normal Codex execution stays simple.
- Sharded inventory files add one extra load step, but skill-specific changes are easier to review and non-skill generated surfaces keep their own namespaces.
- Upstream content is easy to update and audit because protected outputs remain
  byte-identical to the pinned source.
- Public MDF entrypoints stay thin; production enforcement is decomposed into
  focused runtime modules without redefining upstream workflow success criteria.

## Related Decisions

- [Use generated runtime files](../decisions/agent-skills-overlay/generated-runtime-files.md)
- [Replace artifact storage rules](../decisions/agent-skills-overlay/overlay-v2-artifact-storage.md)
- [Use a Codex-only plugin surface](../decisions/agent-skills-overlay/codex-only-plugin-surface.md)
