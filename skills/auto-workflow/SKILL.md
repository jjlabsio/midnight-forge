---
name: auto-workflow
description: "Use when the user explicitly requests MDF's local automatic workflow without PR delivery."
---

# auto-workflow

## Load

1. Resolve the installed plugin root.
2. Run exact upstream `using-agent-skills` discovery and load every applicable
   primitive.
3. Load `auto-workflow-contract.md`, `subagent-dispatch-policy.md`, and the
   routing references required by that policy.
4. Select only the `auto-workflow` profile.

## Root controller

1. Validate task, lock, worktree, branch, Git, artifacts, intent, and authority.
2. Run the profile in order: intent preflight; spec; plan; each build slice;
   whole-build verification and review; one simplification pass; complete
   checks and build; fresh simplification critic; root acceptance and a
   separate commit when changed; local handoff.
3. Wait for every dispatched role's actual terminal response and bind each
   operation to this state table:

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
   | Root accepts verified work | Commit the exact accepted paths and continue. |
   | Existing substantive stop condition | Finish `BLOCKED`. |

4. Write the required handoff and finish with verified local success or
   `BLOCKED`.

**NEVER treat a caller wait timeout, no update, or elapsed silence as executor
failure or terminal evidence. While the executor is `running`, keep waiting.
Do not interrupt it or dispatch a replacement for those reasons.**

Apply only the profile's local authority. Keep the task active and its lock
held. Stage skills do not interpret the profile.
