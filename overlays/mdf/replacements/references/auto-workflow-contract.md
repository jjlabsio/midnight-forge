# Local Auto Workflow Profile

This reference is the only owner of `auto-workflow` composition. Load
`<plugin-root>/references/automatic-operation-contract.md` for every shared
operation rule.

## Sequence

| Current accepted state | Next operation |
| --- | --- |
| Intent is insufficient | Apply the shared intent preflight. |
| Intent is sufficient; no accepted spec | Run spec executor, critic, and root acceptance. |
| Spec is accepted; no accepted plan | Run plan executor, critic, and root acceptance. |
| A ready plan slice remains | Run the per-slice loop. |
| Every slice is accepted and committed | Run whole-build verification, review, and the conditional simplification sequence. |
| Whole build is accepted | Write the verified local handoff. |

## Automatic plan granularity

Each accepted plan slice becomes one complete build executor, critic, and
root-commit operation. Accept the fewest bounded vertical slices that preserve
meaningful independent acceptance, verification, and recovery.

A separate slice boundary must be justified by at least one of:

- an independently accepted user or operational outcome;
- isolation of a materially distinct implementation risk;
- a dependency checkpoint whose failure should stop later work.

Coalesce consecutive work that serves the same accepted outcome and meaningful
verification boundary. A file, architectural layer, helper, test category,
small commit, or implementation-order step alone does not justify a separate
slice. Do not make a slice larger merely to reduce dispatches when doing so
obscures independent acceptance, verification, or recovery.

## Per-slice loop

For each ready plan slice:

1. Root selects one slice.
2. Build executor runs RED, GREEN, and the focused regression/build checks for
   that slice without repeating the whole-build matrix.
3. Root observes the actual diff and verification.
4. Slice critic reviews against the plan and specification.
5. Root dispositions the findings through the shared completion standard.
   Rework only current-delivery blockers until accepted or `BLOCKED`.
6. Root commits exactly the slice-owned paths.
7. Root records the accepted slice and commit OID in the handoff.
8. Root re-reads plan, card, lock, and Git before selecting another slice.

Do not invoke upstream `build auto`. Do not simplify an individual slice.

## Whole-build sequence

After every approved slice is committed:

1. Run the plan's whole-build verification matrix.
2. Run one fresh read-only whole-tree critic against the specification and
   root-observed tree using the existing verification evidence.
3. Disposition its findings through the shared completion standard. Repair
   current-delivery blockers through the affected build slice and repeat only
   invalidated checks.
4. After whole-tree acceptance, dispatch one independent read-only
   simplification audit over the complete changed scope. A finding is material
   only when the change introduced duplicate policy ownership, an unnecessary
   stage, state, persona, registry, or general-purpose abstraction, or
   substantially obscured an execution or authority boundary. Stylistic
   preference, speculative reuse, and rewriting pressure-tested skill guidance
   are not material findings.
5. When the audit reports no material simplification finding, accept it
   without a simplification executor, additional verification, critic, or
   commit.
6. When the audit reports a material simplification finding, run
   `code-simplify` only over that bounded finding, rerun affected verification,
   and dispatch a fresh simplification critic over the actual diff and
   behavior evidence.
7. Commit changed simplification separately; create no empty commit.

## Authority and completion

- Allow task-owned local writes and focused commits.
- Finish with a verified local handoff or `BLOCKED`.
- Keep the task `active` and its lock held.
- Do not ship, complete the whole task, push, mutate a PR, merge, deploy,
  delete, force, take over a stale lock, or clean unrelated state.
