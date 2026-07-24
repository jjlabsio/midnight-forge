---
name: auto-workflow-pr
description: "Use when the user explicitly requests MDF's automatic workflow with GitHub PR delivery."
---

# auto-workflow-pr

## Load

1. Resolve the installed plugin root.
2. Load `automatic-operation-contract.md`, `auto-workflow-contract.md`,
   `auto-workflow-pr-contract.md`, `subagent-dispatch-policy.md`, and the
   routing references required by that policy.
3. Select the `auto-workflow-pr` profile.

## Root controller

1. Before every operation, apply the loaded contracts' complete root boundary
   and revalidate task, card, lock, worktree, branch, latest handoff, Git,
   artifacts, intent, authority, and applicable remote state.
2. Run or resume the selected profile exactly without repeating accepted work.
   This controller map is non-exhaustive and never overrides or omits a
   requirement from the loaded contracts.
3. Run the profile in order: run or resume `auto-workflow` through its accepted
   local result; canonical root-owned `ship`; `github-pr` after GO and fresh
   preflight; remote OID, latest-head checks, mergeability, and conflict
   verification; delivery handoff; verified PR delivery.
4. Preserve every applicable upstream acceptance, TDD, verification, fallback,
   and stop criterion. Route every DDD-class trigger encountered in a
   mode-blind stage or executor through the contract's root-owned
   `auto-doubt-driven-development` recovery.
5. For inherited executor/critic operations, wait for every role's actual
   terminal response and apply this state table:

   | Observed state | Root action |
   | --- | --- |
   | Executor `running` | Wait again. |
   | Executor terminal without a report | Record changed paths and verification, write the no-acceptance handoff and terminal observation, re-read both, then retry only when the contract permits. Never dispatch a critic or accept the result. |
   | Executor successful terminal status with a complete reviewable report | Observe the actual target, persist its report, then dispatch the fresh critic. |
   | Any other executor terminal response | Persist any returned report as evidence and follow ordinary recovery or a substantive stop. Never dispatch a critic or accept the result. |
   | Critic `running` | Wait again. |
   | Critic successful terminal status with a complete `pass` report | Re-observe the bound target and let the root decide acceptance. |
   | Critic successful terminal status with `changes_requested` | Rework the same operation and dispatch a fresh critic. |
   | Any other critic terminal response | Persist any returned report as evidence and follow the contract's recovery or substantive stop rule. |
   | Root accepts verified work and its operation requires a commit | Commit the exact accepted paths and continue. |
   | Root accepts verified work without a commit step | Persist the required acceptance evidence and continue. |
   | Existing substantive stop condition | Finish `BLOCKED`. |

6. Preserve canonical `ship` as its direct three-specialist fan-out and root
   merge; do not wrap it in this executor/critic binding.
7. Write the required delivery handoff and finish with verified PR handoff or
   `BLOCKED`.

**NEVER treat a caller wait timeout, no update, or elapsed silence as executor
failure or terminal evidence. While the executor is `running`, keep waiting.
Do not interrupt it or dispatch a replacement for those reasons.**

Apply only the profile's authority. Allow push and matching PR create/update
only after fresh preflight. Leave the task active and its lock held for a later
explicit, separate `github-after-merge` invocation. This profile does not wait
for, monitor, or resume after merge. Do not merge, deploy, delete, force, take
over a stale lock, or perform unrelated cleanup. Stage skills do not interpret
the profile.
