# Preserve Upstream Command Contracts in MDF Adapters

## Status

Accepted

## Date

2026-07-14

## Context

Midnight Forge converts selected commands from the pinned
`vendor/agent-skills/commands/*.toml` source into Codex-readable `SKILL.md`
adapters. The upstream command prompt contains more than a description: it can
define execution order, verification, output shape, completion behavior,
persona composition, and stop conditions.

MDF also needs local behavior that the upstream command does not know about,
including canonical `.mdf` state, worktrees, task ownership, artifact paths,
authority revisions, and external-action envelope checks. Mixing these concerns
silently risks weakening the upstream workflow or making an adapter appear to
be the original command when it is not.

## Decision

Migrate command adapters one command at a time while keeping the upstream
contract and MDF adaptation visibly separate.

### 1. Preserve the pinned source boundary

- Treat `vendor/agent-skills` as immutable provenance. Do not edit the vendor
  TOML or protected upstream skills as part of an adapter migration.
- Edit the corresponding
  `overlays/mdf/replacements/skills/<command>/SKILL.md` first.
- Regenerate the tracked `skills/<command>/SKILL.md` surface with the sync
  renderer. Do not hand-edit generated runtime files.
- Leave inventory and source hashes unchanged unless the source mapping itself
  intentionally changes.

### 2. Migrate one command at a time

For each selected command:

1. Read the complete upstream TOML description and prompt.
2. Compare it with the current MDF adapter and identify omissions or semantic
   changes.
3. Discuss the preservation and adaptation plan before editing that command.
4. Change only that command's replacement and generated output.
5. Verify and commit that command independently before selecting the next one.

Do not batch-rewrite unselected commands or create an automatic converter that
erases command-specific judgment.

### 3. Preserve the upstream command contract explicitly

The adapter must retain the upstream `description` in frontmatter and must
make the important prompt requirements readable in an **Upstream command
contract** section. Preserve, as applicable:

- execution order and mode/argument parsing;
- delegated skill and persona calls;
- review axes and specialist responsibilities;
- tests, build, and other verification requirements;
- output format, severity categories, and file/line evidence;
- commit, completion, rollback, and stop conditions;
- fallback behavior when an upstream tool or persona is unavailable.

An adapter may clarify wording for Codex, but it must not silently delete,
weaken, or replace an upstream requirement with a generic MDF rule.

### 4. Keep skills, personas, and fan-out distinct

- Loading an upstream skill in the current context is a skill hop, not an
  additional subagent.
- A command that invokes one persona, such as a focused web performance audit,
  remains a single-persona command; do not add fan-out merely because the
  persona uses other skills.
- A command whose upstream contract explicitly requires fan-out, such as
  `ship`, must preserve its independent subagent calls, parallel dispatch,
  flat delegation, and main-context merge. Do not collapse that fan-out into a
  single review or invent a second orchestration layer.

### 5. Separate MDF/Codex adaptations from upstream rules

MDF-specific guidance belongs in a clearly labeled adaptation section. It may
define how the upstream contract is realized locally, including:

- installed plugin root and canonical project-root resolution;
- `.mdf/work/<work-id>/` artifacts, task cards, append-only index projections,
  locks, and worktree/branch checks;
- exact current spec/plan revisions and integrity hashes;
- task-owned paths, clean baselines, review and downstream-impact gates;
- local evidence, completion mutations, lock release, and external-action
  envelope checks;
- Codex tool limitations and truthful reporting of unavailable or degraded
  reviewers.

These adaptations must not change upstream success criteria. A local artifact or
MDF completion record is evidence of workflow state; it is not a substitute for
the upstream command's tests, review, build, rollback, or quality requirements.
MDF authority evidence does not add a human approval checkpoint.

### 6. Verify and commit each adapter

After changing an adapter, run the applicable checks:

```bash
node scripts/sync-agent-skills.js
node scripts/validate-agent-skills-port.js
node scripts/validate-agent-skills-sync.js
node vendor/agent-skills/scripts/validate-skills.js
git diff --check
```

Also confirm that the replacement and generated files for the command are
byte-identical. Stage only that command's replacement and generated files, then
create one focused documentation commit, for example:

```text
docs: preserve <command> command contract in MDF adapter
```

Do not push, open a pull request, merge, deploy, or perform another external
mutation as part of the adapter commit.

### 7. Record task evidence separately

When the migration is performed under an MDF task, record each command's
preserved upstream rules, MDF adaptations, commit hash, and verification in the
canonical `.mdf/work/<work-id>/` evidence. Keep the card as the source of truth
and append one current projection to `.mdf/index.jsonl` for each state change.
Local MDF metadata is not implementation code and is not blindly staged with
the adapter commit.

## Consequences

- Future upstream updates can be compared against a stable, immutable source
  and an explicit MDF overlay.
- Each adapter change is reviewable and independently revertible.
- Command-specific workflow semantics remain visible instead of being hidden in
  a generic migration layer.
- Generated runtime files stay reproducible through the existing packaging
  validators.
- The process takes more discussion and commits than a bulk conversion, but it
  prevents accidental loss of execution order, reviewer composition, output
  contracts, and stop conditions.
