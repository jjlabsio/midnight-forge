# Midnight Forge Agent Guidance

## Scope

This file governs agents that modify the Midnight Forge repository itself. It
is a repository-maintenance and packaging policy; it is not a replacement for
the installed runtime skills and must not be copied into consumer projects as
the upstream `agent-skills` repository's `AGENTS.md` warns.

## Mission

Midnight Forge (`mdf`) is an orchestration and packaging layer over the pinned
upstream [`agent-skills`](vendor/agent-skills) project. Its purpose is to make
the upstream engineering workflows productive in Codex while preserving their
workflow intent, quality gates, and ongoing update path.

MDF is not a fork of the upstream primitive workflows. Prefer reusing the
upstream skill exactly. Add MDF behavior only for Codex representation,
routing, context, local task state, authority, safety, packaging, or explicit,
documented MDF needs that do not alter upstream semantics.

## Thin, model-led harness

MDF intentionally uses a thin, best-effort harness. Assume the model is
capable of following clear instructions; do not add runtime machinery merely
to compensate for verbose or ambiguous guidance. Keep skill instructions
short, explicit, and intent-preserving, with required actions, outputs,
authority boundaries, and stop conditions stated plainly. Prefer model-followed
recording and judgment over new hooks, schemas, validators, or orchestration
layers. This principle does not relax safety, authorization, or destructive
action boundaries; when hard enforcement is necessary, keep it narrow and
proportionate to the risk.

## Skill writing

Use when designing or writing a skill.

- Keep `description` short and generic. Optimize for routing, not documentation.
- Keep skill bodies concise and operational. Include only what changes agent
  behavior or is required for correct execution.
- Start with the minimum guidance that addresses an observed failure. Add
  detail only when evaluation reveals ambiguity, omission, or a rationalization
  path.
- Remove duplicated guidance, obvious explanations, and repeated examples.
  Prefer one strong rule or example over several weaker variations.
- Do not shorten carefully chosen behavior-shaping language merely for style or
  word count; preserve the wording needed to make the behavior reliable.
- Prefer action-first bullets, numbered workflows, and command examples over
  explanatory prose.
- Use a helper script only for frequent, deterministic, mechanical work when
  the script stays small, obvious, and cheaper to maintain than repeated model
  instructions.
- Do not move semantic judgment, routing, authority, lifecycle decisions, or
  broad workflow orchestration into a helper.
- Quote `description` in YAML front matter.

## MDF convention references

Skill-writing guidance and MDF-specific conventions are separate concerns. This
section governs how MDF conventions are maintained; it does not restate their
operational contracts.

MDF-specific conventions are defined by authoritative documents under
`references/`, `docs/architecture/`, and `docs/decisions/`.

Before creating or modifying an MDF skill, workflow, shared contract, or
orchestration rule:

- Identify and read every applicable authoritative document.
- Treat those documents as the source of truth for the convention.
- Reference existing conventions instead of duplicating or redefining them in
  a skill or workflow document.
- If documents conflict, resolve or update the authoritative document before
  changing consuming skills.
- If no authoritative document exists, document the new MDF convention first,
  then update its consumers.
- When a convention is required at runtime, make the consuming skill load or
  explicitly reference the authoritative document.

## Non-negotiable source boundaries

1. Each checked-in `vendor/agent-skills` tree is an immutable snapshot of one
   pinned upstream commit. Never hand-edit it. An upstream update replaces the
   snapshot with a verified commit and records its provenance.
2. `vendor/agent-skills` is the authority for upstream-owned content. Do not
   rewrite an upstream skill or reference in an overlay to preserve local
   wording.
3. Generated runtime and packaging files under `skills/`, `references/`,
   `agents/`, `.codex-plugin/`, `.agents/plugins/`, and generated `README.md`
   are output. Edit the vendor snapshot or an overlay input, then run the sync
   renderer. Never hand-edit generated output.
4. The normal source direction is one-way:

   ```text
   pinned upstream + explicit MDF inputs
       -> inventory + sync renderer
       -> generated Codex runtime surface
   ```

5. Every non-identical generated surface must be explicitly classified,
   attributable, and verifiable. Do not introduce implicit fragments, patches,
   or semantic overlays.

## Surface classification

Use exactly one of these classifications for each generated surface:

| Surface | Meaning | Required behavior |
| --- | --- | --- |
| `upstream-identical` | An upstream skill, reference, persona, guide, or supporting file is directly usable in Codex. | Keep the generated file byte-identical to the pinned vendor source. |
| `mdf-rename-or-adapter` | An upstream command or other contract needs a Codex-native entrypoint or format adaptation. | Preserve the upstream contract and source hash; put the MDF adaptation in an explicit adapter with rationale and review risk. |
| `mdf-only` | A capability has no upstream source and belongs to MDF. | Do not claim upstream ownership or silently replace an upstream primitive. |

“Preserve upstream” means byte identity when the representation is the same;
for a required command-to-skill conversion it means contract preservation. An
adapter must retain applicable upstream input requirements, execution order,
delegations, verification, output shape, completion rules, fallback behavior,
and stop conditions. MDF may add local realization rules, but it must not
weaken or redefine upstream success criteria.

## Orchestration boundary

The upstream primitives define what a sound engineering workflow means. MDF
defines how Codex discovers, composes, stores, and safely executes that
workflow.

- Keep each skill independently usable with its own inputs, preflight, output,
  authority boundary, and stop conditions.
- Compose skills only through public contracts; do not add caller-specific
  modes, private handshakes, or hidden assumptions.
- Let callers pass intent and verified context, while the called skill validates
  its own state and owns its behavior.

MDF orchestration may own:

- intent-to-skill routing and applicable lifecycle composition;
- Codex entrypoints and context loading;
- canonical `.mdf` cards, artifacts, locks, worktrees, and approvals;
- task ownership, external-action confirmation, recovery, and handoff notes;
- bounded subagent dispatch and root-only synthesis;
- generated-surface packaging and provenance validation.

MDF orchestration must not:

- duplicate or paraphrase upstream workflow content unnecessarily;
- replace upstream quality gates with a local completion flag or JSON result;
- hide semantic decisions in a broad workflow runtime, opaque policy module,
  or machine-only protocol;
- replace model-led judgment with a hard-coded model, persona, or route; use
  the reviewed dispatch policy when subagent routing is applicable;
- silently skip an applicable upstream skill;
- create router personas, nested persona trees, or sequential agents whose main
  value is summarizing another agent's output.

Load `using-agent-skills` as the exact upstream discovery primitive and then
load every other applicable upstream primitive. Do not treat `use-mdf` as a
replacement for upstream skill discovery, lifecycle stages, or Definition of
Done. When upstream and MDF rules appear to conflict, stop, identify the
conflict, and record a port decision rather than silently choosing one.

Use parallel dispatch only for genuinely independent investigations with no
shared mutable state or ordering dependency. Keep one writer per shared
worktree and synthesize reports in the root context. Sequential lifecycle
steps should preserve their human or model checkpoints instead of adding a
paraphrasing orchestrator.

## Overlay admission rules

Before adding or changing a surface, decide in this order:

1. Can the exact upstream primitive be reused? If yes, do that.
2. Is the change only MDF routing, state, authority, safety, or packaging? If
   yes, add or update an `mdf-only` surface.
3. Is a Codex format or entrypoint conversion unavoidable? If yes, use an
   explicit `mdf-rename-or-adapter` surface.
4. Would the change alter upstream workflow semantics? Stop and obtain an
   explicit port decision; do not hide it in an overlay.

An adapter is an exception, not a second implementation of the upstream
workflow. Its inventory entry must identify the upstream source, current
`baseSha256`, adaptation rationale, and review risk. The replacement must
separate an **Upstream contract** section from an **MDF adaptation** section.

Do not add an overlay merely for preferred wording, local style, or convenience
when the upstream file is already usable. Do not use an overlay to preserve
behavior that should instead be fixed upstream.

## Upstream update policy

“Continuously updated” means that MDF has a controlled, reviewable update path;
it does not mean that runtime behavior follows an unpinned live branch.

Every update must:

- pin one exact upstream commit and record the previous and target commits;
- compare the complete `skills/**`, `references/**`, `commands/**`,
  `agents/**`, and `hooks/**` surfaces, including skill-local scripts;
- classify additions, deletions, modifications, and renames;
- update vendor source before regenerating output;
- refresh inventory hashes and review every changed adapter;
- preserve upstream hooks in the vendor snapshot without activating them
  automatically;
- fail closed on imports from runtime-excluded files or unresolved Codex hook
  ports;
- regenerate the complete runtime surface and store a categorized report.

Never treat generated output as upstream authority, and never declare an
upstream update successful while a changed adapter or port gap remains
unreviewed. Follow the repository-local upstream update skill and
[`docs/decisions/agent-skills-overlay/upstream-update-workflow.md`](docs/decisions/agent-skills-overlay/upstream-update-workflow.md)
for the full procedure.

## Verification and completion

Test executable behavior and machine-enforced contracts, not instructional
wording. Do not assert that a skill or reference contains or omits specific
prose; review model-facing semantics directly. Exact-text checks are allowed
only when the text is itself a machine-consumed format, generated-byte
contract, or provenance boundary.

For changes to the source, inventory, overlays, or generated surface, run:

```bash
node scripts/sync-agent-skills.js --dry-run
node scripts/validate-agent-skills-sync.js
node scripts/validate-agent-skills-port.js
node scripts/validate-workflow-helpers.js
```

For an adapter or upstream update, also run the applicable upstream validators
and review the complete source diff. A passing packaging validator proves
source provenance, inventory coverage, and generated equality; it does not
prove review quality, semantic correctness, task completion, approval, or
external authority.

Keep changes atomic and focused. Do not stage `.mdf` runtime state, unrelated
files, secrets, or generated artifacts that are not part of the declared
surface. Before handoff, report what changed, what was intentionally left
untouched, which validations passed, and any unresolved concern.

## References

- [Agent Skills Overlay System](docs/architecture/agent-skills-overlay-system.md)
- [Preserved MDF Contracts](references/mdf-preserved-contract.md)
- [Orchestration Patterns](references/orchestration-patterns.md)
- [Agent Personas](docs/agents.md)
- [Command Adapter Decision](docs/decisions/agent-skills-overlay/command-adapter-migration.md)
- [Generated Runtime Files Decision](docs/decisions/agent-skills-overlay/generated-runtime-files.md)
- [Upstream Update Workflow](docs/decisions/agent-skills-overlay/upstream-update-workflow.md)
- [Upstream Skill Anatomy](vendor/agent-skills/docs/skill-anatomy.md)
