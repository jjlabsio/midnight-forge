# Decision: Source-first upstream agent-skills updates

## Decision

Use a source-first, full-surface update workflow for `agent-skills`. The pinned
vendor snapshot and lock provenance are authoritative. MDF overlays and
generated Codex files are derived inputs and outputs, not alternate upstream
sources.

Every update compares the complete `skills`, `references`, `commands`,
`agents`, and `hooks` trees. Root upstream scripts and ordinary docs remain
visible in the vendor snapshot and diff report but are excluded from Codex
runtime import. Skill-local scripts remain part of the skill surface. Any
import from an excluded artifact blocks the update until ported or explicitly
decided.

Hooks are preserved in the upstream vendor tree but are not activated merely
because they exist. Claude hooks require an explicit Codex-native port with an
event, payload, output, trust, conversion, and verification record. A port is
separate from changing an upstream skill.

## Consequences

The workflow produces a larger diff report than a generated-output comparison,
but new upstream files cannot be lost because they are currently unreferenced.
Upstream-identical surfaces remain byte-stable, while MDF-only and adapter
surfaces remain reviewable. Generated files can be recreated deterministically
from the vendor snapshot, inventory, and overlay inputs.

## Verification

The update runs the MDF sync renderer, sync validator, port validator, upstream
skill validator, upstream command validator, and whitespace checks. The full
report records previous/target commits, categorized changes, generated impact,
exclusions, port gaps, and all results.
