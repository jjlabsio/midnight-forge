---
name: build
description: "Implement tasks incrementally — build, test, verify, commit. Add \"auto\" to run the whole plan in one approved pass."
---

# build

Build is the upstream incremental implementation command adapted to the MDF
task state model. Resolve the installed plugin root before loading any skill or
reference; an unresolved plugin root is a stop. Load and run the exact upstream
`../using-agent-skills/SKILL.md` discovery workflow, resolve this canonical
adapter, then load the exact upstream
`../incremental-implementation/SKILL.md` alongside
`../test-driven-development/SKILL.md`. Load
`../code-review-and-quality/SKILL.md`,
`../debugging-and-error-recovery/SKILL.md` on failure, and every other
applicable primitive selected by discovery.

When the caller supplies normalized automatic stage context, also load
`../../references/auto-workflow-contract.md` and require `Stage` to select this
canonical `build` adapter and exactly one plan slice or bounded build. Apply its
acceptance baseline, verification profile, continuity, lease, provisional
output disposition, capabilities, and mandatory Two-Key gate. The context's
mode is provenance only; a raw mode or handoff without normalized context is
malformed and finishes `BLOCKED`. A direct invocation without automatic
context remains standalone, so standalone `/build` and `/build auto` retain
the upstream commit behavior.

The normalized acceptance baseline determines whether the target is one
approved plan slice or one bounded request backed by the active task Context.
For a bounded request, do not require or generate a spec or plan. The
verification profile determines whether RED/GREEN, full regression,
build/typecheck/lint, or static-content validation applies. Never infer either
decision from provenance.

## Upstream command contract

The following command behavior is preserved from the upstream build command.
MDF state and artifact rules below adapt how this behavior is recorded. In
standalone `/build` and standalone `/build auto`, they do not remove or reorder
the upstream execution steps. Under normalized automatic stage context, the
shared contract intentionally moves the existing commit criterion to the root
after the required downstream gates. The build output disposition is
provisional and forbids staging or commit; the implementation, verification,
and risk checks remain unchanged.

### Modes and arguments

- `/build` implements the next pending task, then stops: one careful slice at a
  time.
- `/build auto` generates the plan if needed, gets one standalone approval,
  and then implements every task without stopping between tasks.
- Treat `auto` (canonical) or `all` as autonomous mode. Anything else (or
  empty) selects the default single-task mode.
- Standalone `/build auto` is not a shorter verification path. It runs the same
  test-driven loop for every task; it only removes the human stepping between
  tasks.

An automatic build stage never invokes `/build auto` or `/build all`. Its
normalized context selects exactly one bounded task for the default loop and
states the required verification. It cannot remove an applicable RED/GREEN,
regression, build, review, task-owned-path, lock, or high-risk check. This build
stage never selects downstream stages, stages paths, commits, or completes the
whole MDF task.

### Default: one task

Under normalized automatic stage context, use exactly the target selected in
`Stage` and `Acceptance baseline`; this adapter never chooses another task or
recovery point. Without that context, pick the selected or next pending task
from the approved plan under the standalone rules. Then execute this exact
sequence:

1. Read the task's acceptance criteria.
2. Load relevant context: existing code, patterns, and types.
3. Write a failing test for the expected behavior (RED), unless the normalized
   verification profile classifies the target as documentation-only or static
   content and explicitly selects applicable project validation instead of an
   invented behavioral test.
4. Implement the minimum code to pass the test (GREEN), or make the smallest
   scoped static-content edit when the verification profile selected that
   path.
5. Run the full test suite for regressions unless the normalized verification
   profile explicitly replaces an inapplicable behavioral suite with the
   named static-content validation. Standalone behavior keeps the upstream full
   regression requirement.
6. Run the build when the project has a build step. A normalized static-content
   profile may mark build, typecheck, or lint not applicable only when it names
   the changed paths and why they cannot affect that check; behavioral changes
   run every applicable build, typecheck, and lint check.
7. In standalone `/build`, commit with a descriptive message. When normalized
   automatic context is present, obey its provisional output disposition: stop
   after implementation and verification, do not stage or commit, and return
   exact changed paths and evidence to the root.
8. In standalone `/build`, preserve the existing selected-task completion
   behavior. Under normalized automatic context, keep the MDF task active and
   return the provisional bounded result. It is neither a committed plan slice
   nor whole-task completion, and this adapter does not choose what follows.

### Autonomous: the whole plan (`/build auto`)

Use this once a spec exists when plan and build should run in one approved pass.
It removes manual stepping between tasks, not verification. Every task still
earns a passing test, the full regression suite, a successful build, its own
commit, and readable plan-slice completion evidence.

1. Require a spec. Look only for a spec at a known path: `SPEC.md` at the repo
   root, `docs/SPEC.md`, or a file under `spec/`. A README or arbitrary
   document does not count. If none exists, stop and tell the user to run
   `/spec` first; do not invent requirements.
2. Establish a clean baseline with `git status --porcelain`. Uncommitted
   changes outside the expected planning artifacts (`SPEC.md`,
   `docs/SPEC.md`, `spec/*`, `tasks/plan.md`, and `tasks/todo.md`) are a stop:
   ask the user to commit, stash, or confirm how to handle them. Autonomous
   per-task commits must not absorb unrelated local work.
3. Plan if needed. If there is no `tasks/plan.md`, invoke the
   `planning-and-task-breakdown` skill to generate one.
4. Present the full plan and wait for one unambiguous affirmative such as
   `approve`, `go`, or `yes`.
   If `tasks/plan.md` was generated, commit it as one preparatory commit before
   the first task so it cannot bleed into that task's commit.
5. Execute every task in dependency order. Use each task's declared
   dependencies; when dependencies are not explicit, use the plan's listed
   order. For each task, run the complete default loop:
   `RED → GREEN → full regression suite → build → review → commit`. Record the
   plan-slice evidence.
   Stage only files touched by that plan slice plus its task-status update;
   never use `git add -A` blindly. Make exactly one commit per slice so every
   point remains a clean rollback point.
6. Stop and ask the user instead of pushing through, even in standalone
   `/build auto`, when:
   - a test cannot be made to pass or the build breaks without an obvious fix;
     follow `../debugging-and-error-recovery/SKILL.md`;
   - the spec is ambiguous or a task needs a decision not covered by it;
   - a task is high-risk or irreversible, including auth/permission changes,
     destructive data migrations, payments, deletions, deploys, secrets, or
     anything that cannot be undone with `git revert`; follow
     `../doubt-driven-development/SKILL.md` and obtain explicit sign-off.
   After the user resolves a blocker, they re-invoke the applicable workflow;
   it resumes from the next pending plan task.
7. Summarize tasks completed, tests added, commits made, and anything skipped,
   flagged, or left for the user.

If any step fails, follow the exact upstream
`../debugging-and-error-recovery/SKILL.md`.

## MDF/Codex adaptation

These are MDF integration rules. They add state ownership, evidence, and
execution safety around the upstream contract; they do not replace its task
loop or reduce its verification.

### Canonical inputs and task authority

1. Resolve the canonical project root and installed plugin root. In
   normalized automatic context, use only its `Acceptance baseline`. A bounded
   baseline contains the settled request and active task Context and
   intentionally has no spec or plan. A plan-slice baseline contains the exact
   approved specification and plan bytes, paths, and SHA-256 values. Without
   automatic context, use the standalone approved spec/plan inputs. In MDF,
   canonical `.mdf/work/<work-id>/spec-NNN.md` and `plan-NNN.md` revisions are
   the project-equivalent artifacts for the upstream spec and plan; a README or
   arbitrary document cannot satisfy a plan-backed baseline.
2. Read the task card and current index projection. Under normalized context,
   confirm its one selected target, owned paths, dependencies when applicable,
   and matching task lock; do not select a next target here. A bounded baseline
   intentionally has no plan, while a plan-slice baseline supplies its exact
   task and dependencies. Without automatic context, choose exactly one
   selected or next pending plan task under the standalone procedure. Do not
   infer readiness from card text that conflicts with canonical state, a live
   lock, or the approved scope.
3. Confirm that the current worktree is the locked worktree and the expected
   branch is checked out. The initial slice requires a clean baseline. During
   a normalized recovery context, the known provisional diff may remain staged
   or unstaged only when `Continuity` binds it to the same target, base `HEAD`,
   and owned paths. Stop for unrelated dirt, lock conflict, ambiguous
   ownership, stale continuity, or missing worktree setup. This is the MDF
   equivalent of the upstream autonomous clean-baseline guarantee.

### Automatic-stage producer and verification

When normalized build stage context is present, apply the shared Two-Key lease
without duplicating it:

1. The root supplies the current canonical task, lock, handoff, Git baseline,
   acceptance context, exact leased implementation and test paths, required
   commands, and stop conditions. One bounded producer is the sole writer and
   may write only those leased paths while running exact discovery, this
   adapter, and every applicable primitive above except `code-simplification`.
   The build producer neither loads nor runs simplification. Stage inclusion,
   omission, and order after build belong exclusively to the root composition
   contract.
2. The producer cannot mutate canonical `.mdf` cards, locks, handoffs, indexes,
   or observations; stage any path for review or commit; commit; complete a
   task or slice; mutate remote or external state; accept its work; delegate;
   or perform final synthesis. It returns its resolved skills, actual changed
   paths, focused result, and command evidence as claims for root observation.
3. After positive producer terminality, the root independently observes the
   actual diff, owned and unrelated paths, canonical and Git state, and each
   command's exact invocation, cwd, exit status, output reference, pre/post
   `HEAD`, and binding to the observed diff. A producer report, self-authored
   hash, or completion phrase is not evidence.
4. A distinct fresh-context, read-only, non-delegating verifier receives the
   original build contract and complete root-observed bundle without producer
   reasoning. It assesses the actual diff and bound verification evidence
   against the selected task or quick acceptance baseline. The root alone
   reconciles `PASS`, `REWORK`, or `BLOCKED` and decides whether the result may
   proceed to downstream gates.

Missing keys, stale or changed state, unrelated dirt, scope violation,
non-success command evidence, exhausted cycles, or uncertain writer
terminality stops under the shared contract. Never start a verifier or another
writer while producer write capability may remain.

### Execution, verification, and review

4. Perform the complete upstream per-task sequence selected by the normalized
   `Verification profile`. MDF's focused checks, review, and downstream-impact
   gate are additional checks; they do not stand in for any profile-required
   full suite or build. A plan-slice profile preserves:

   `acceptance/context → RED → GREEN → full test suite → build → internal
   review/gates → provisional plan-slice evidence`.

   A bounded profile preserves:

   `acceptance/context → RED → GREEN (behavioral changes) → applicable
   validation/full regression → build/typecheck/lint when applicable →
   internal review/gates → provisional bounded evidence`.

   The profile may select static-content validation only through the explicit
   not-applicable reasoning above. This adapter returns after its provisional
   evidence and does not select simplification, staging, review, commit, or
   whole-task completion. A later change invalidates affected build evidence
   and must be represented by a fresh root-created stage context.

5. Review the diff and all verification results against the normalized
   acceptance baseline and relevant project documentation: full specification,
   plan, and task acceptance for a plan slice, or the bounded request and active
   task Context for bounded work.
   The producer applies the exact upstream internal review to its actual diff;
   this does not replace the shared independent verifier or the canonical
   downstream `review` stage. Return reasoning and downstream-impact findings
   in provisional evidence; only the root may record canonical MDF notes.
6. Apply the downstream-impact gate in ordinary language. Actionable findings,
   verification regressions, ambiguity, or a scope change must be fixed,
   returned for root-owned rework or stopped before `PASS`. A clean command
   result is not a substitute for semantic correctness.

### Commit, completion, and artifacts

7. In standalone `/build`, stage only the exact task-owned project paths and
   create one focused commit with a descriptive message. Under normalized
   automatic context, return provisional evidence without staging any path or
   committing. The root composition contract owns any later review-candidate
   staging and focused commit. `.mdf` state is local workflow metadata and is
   not blindly staged as implementation code.
8. Under normalized automatic context, re-read the card, lock, handoff, index
   projection, and Git state before returning evidence. This skill does not
   mark a plan slice committed, mark the MDF task `done`, release its lock,
   push, mutate a PR, or advance lifecycle. Report bounded build status
   separately from root-owned outcomes.
9. If an automatic stage's plan-backed acceptance baseline references a
   project-visible `tasks/plan.md`,
   preserve the upstream preparatory-commit rule. If the MDF plan adapter
   created only the canonical `.mdf/work/<work-id>/plan-NNN.md` artifact, record
   it in MDF state and do not create an unsynchronized duplicate or stage local
   `.mdf` state as implementation code. This rule is inapplicable when the
   acceptance baseline intentionally has no plan.

### Failure and recovery

On a test, verification, or build failure, preserve the evidence and follow the
exact upstream debugging workflow before changing more code. Standalone modes
keep the upstream user stop and resume behavior. Under normalized automatic
context, return failure and debugging evidence to the root; only the root may
choose a bounded `REWORK` context or finish `BLOCKED`. Do not ask an
intermediate unattended question, select a new task or re-entry point, or
assume rollback. A fresh producer requires root reconciliation of the actual
provisional diff, task-owned paths, lock, handoff, base, and `HEAD`.

For a plan-slice baseline, any spec ambiguity or task decision not covered by
the spec finishes `BLOCKED`. For a bounded baseline, any acceptance or scope
ambiguity finishes `BLOCKED`. Scope expansion, high-risk or irreversible work,
missing authority, canonical-state mutation, repeated no-progress, or an
exhausted recovery-cycle bound also finishes `BLOCKED`. A failed or repaired
command invalidates the evidence bound to the prior diff.

### Automatic continuation and final verification

Standalone `/build auto` and `/build all` repeat the same upstream loop over
all approved plan tasks. A normalized automatic build context never enters
this whole-plan mode: it selects exactly one plan slice or bounded task and
requires provisional output. The root composition contract alone selects any
later simplification, review-candidate staging, canonical review, commit, next
slice, or delivery operation.

After every approved plan task commits in standalone `/build auto`, run the
whole-build verification matrix from the plan and perform a final review
against the full specification. In automatic composition, the root may select
those operations as separate normalized Two-Key stages after all slices
commit; this build invocation does not select or execute them. The final matrix
is additive and never replaces the full test suite and build required inside a
plan-slice profile. Whole MDF task completion remains outside this skill.
