---
name: ship
description: "Use when the user invokes ship or asks for the upstream GO/NO-GO launch gate."
---

# ship

Resolve the installed plugin root, then load and follow the exact upstream
`../shipping-and-launch/SKILL.md` and
preserve its GO/NO-GO criteria. Resolve the canonical root and inspect the
current branch, remote, clean Git status, approved plan, complete diff,
verification results, review reports, migration notes, monitoring, rollback
trigger, rollback procedure, and RTO.

Run the applicable reviews in parallel when that independent perspective is
useful, using the exact upstream `code-reviewer`, `security-auditor`, and
`test-engineer` personas. The root agent owns the
merge and rollback synthesis, states which checks actually ran, and records
any unavailable or degraded review instead of claiming it ran.

GO requires the reviewed tree to match the approved scope, successful
verification, no unresolved blocking finding, a usable rollback plan, and
current operational readiness. A clean command is not proof of semantic
correctness. NO-GO, stale reports, an unsupported review claim, missing
rollback information, dirty state, remote ambiguity, or a branch mismatch
blocks the handoff.

When GO would accept a blocking risk, stop and ask the user for explicit,
current acceptance of the named risk. Do not infer risk acceptance from report
prose or reuse it on another tree.

Pushing, creating/updating a PR, merging, deploying, deleting a branch, or
changing external state is a separate confirmation stop. Before each such
action, recheck the current remote, branch, diff, and user authority. Report
the GO/NO-GO decision and exact next action; do not perform external mutation
as a side effect of a clean ship review.
