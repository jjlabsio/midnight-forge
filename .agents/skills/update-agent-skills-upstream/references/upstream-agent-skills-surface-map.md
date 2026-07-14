# Upstream Agent Skills Surface Map

This map is the review boundary for the pinned snapshot in
`vendor/agent-skills.lock.json`. It is intentionally broader than the current
generated output so additions cannot disappear through reference filtering.

| Upstream path | Compare | Current Codex disposition |
| --- | --- | --- |
| `skills/**` | Complete tree, including supporting files and local scripts | Generate through inventory; preserve upstream-identical bytes or document a named adapter |
| `references/**` | Complete tree | Generate through inventory when imported; otherwise preserve vendor and report disposition |
| `commands/**` | Complete tree and command contracts | Compare and report; generate only when an explicit Codex adapter exists |
| `agents/**` | Complete tree | Generate through inventory when supported |
| `hooks/**` | Complete tree, manifest, scripts, tests, and docs | Preserve in vendor; review each possible Codex-native port separately |
| `scripts/**` at upstream root | Complete tree for diff visibility | Explicitly excluded from Codex runtime import; fail closed if imported |
| ordinary upstream `docs/**` | Complete tree for diff visibility | Explicitly excluded from Codex runtime import unless an inventory entry says otherwise |
| `skills/**/scripts/**` | Complete tree | Skill-local runtime resource; follow the owning skill |

## Pinned baseline

The current baseline is the commit recorded in
`vendor/agent-skills.lock.json`. The update skill must print both that commit
and the target commit before mutation. A report must never describe only a
working-tree diff without the two commit identifiers.

## Classification rules

- `added`: target path has no baseline path.
- `deleted`: baseline path has no target path.
- `modified`: paired paths have different bytes or mode.
- `renamed`: deterministic content pairing identifies a moved path; report the
  old and new paths even when content also changed.
- `unchanged`: retain the existing ownership classification and source hash.

For every changed file, record category, source path, target path, ownership
class, generated impact, and verification status. A path with no generated
impact still belongs in the full report.

## Hook review fields

Each hook review records source path, event, trigger conditions, payload fields,
output and exit contract, timeout, trust boundary, environment assumptions,
Codex target, conversion reason, status (`ported`, `gap`, `preserved-vendor`,
or `not-applicable`), and focused verification. Claude-specific activation is
never an implicit Codex disposition.
