---
name: auto-workflow
description: "Use when the user explicitly requests MDF's local automatic workflow without PR delivery."
---

# auto-workflow

## Load

1. Resolve the installed plugin root.
2. Load `<plugin-root>/references/automatic-operation-contract.md`,
   `<plugin-root>/references/auto-workflow-contract.md`,
   `<plugin-root>/references/subagent-dispatch-policy.md`.
3. Select the `auto-workflow` profile.

## Root controller

1. Before every operation, apply the loaded contracts' complete root boundary
   and revalidate task state, intent, worktree, branch, latest handoff, Git,
   artifacts, intent, and authority.
2. Run the selected profile exactly. This controller map is non-exhaustive and
   never overrides or omits a requirement from the loaded contracts.
3. Run the profile in order: intent preflight; spec; plan; each build slice;
   one whole-build verification matrix and whole-tree review; one independent
   read-only simplification audit; bounded simplification, affected checks,
   and a fresh simplification critic only when that audit finds a material
   opportunity; root acceptance and a separate commit when changed; local
   handoff.
4. Preserve every applicable upstream acceptance, TDD, verification, fallback,
   and stop criterion. Route every DDD-class trigger through the contract's
   root-owned `auto-doubt-driven-development` recovery; keep ordinary critic
   rework in the operation loop.
5. Wait for every dispatched role's actual terminal response and bind each
   operation to this state table:

   | Observed state | Root action |
   | --- | --- |
   | Executor `running` | Wait again. |
   | Executor terminal without a report | Record changed paths and verification, write the no-acceptance handoff with its generic attempt index, then retry only when the contract permits. Observation remains best-effort and never gates this path. Never dispatch a critic or accept the result. |
   | Executor successful terminal status with a complete reviewable report | Observe the actual target, persist its report, then dispatch the fresh critic. |
   | Any other executor terminal response | Persist any returned report as evidence and follow ordinary recovery or a substantive stop. Never dispatch a critic or accept the result. |
   | Critic `running` | Wait again. |
   | Critic successful terminal status with a complete `pass` report | Re-observe the bound target and let the root decide acceptance. |
   | Critic successful terminal status with `changes_requested` | Apply the shared root disposition contract. Rework only `fix-now`, stop for `needs-user`, and permit acceptance when no current-delivery blocker remains. |
   | Any other critic terminal response | Persist any returned report as evidence and follow the contract's recovery or substantive stop rule. |
   | Root accepts verified work and its operation requires a commit | Commit the exact accepted paths and continue. |
   | Root accepts verified work without a commit step | Persist the required acceptance evidence and continue. |
   | Existing substantive stop condition | Finish `BLOCKED`. |

6. Write the required handoff and finish with verified local success or
   `BLOCKED`.

**NEVER treat a caller wait timeout, no update, or elapsed silence as executor
failure or terminal evidence. While the executor is `running`, keep waiting.
Do not interrupt it or dispatch a replacement for those reasons.**

Use the profile for composition and completion, and the shared root boundary
for outcome-based authority. Keep the task active. Stage
skills do not interpret the profile.
