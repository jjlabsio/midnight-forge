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

For `mode: auto-workflow`, `mode: auto-workflow-pr`, or
`mode: quick-workflow-pr`, also load
`../../references/auto-workflow-contract.md` and apply its mandatory `Each plan
slice or bounded build` Two-Key lease. Each of these modes invokes this skill
for one bounded task in default single-task mode and receives provisional
implementation and verification evidence without a commit. The root may
stage only the exact task-owned review-candidate paths after the build and any
applicable simplification Two-Key gates return `PASS`; staging is not a commit,
and canonical review receives the staged slice or bounded-change diff. Only
after canonical review returns `PASS` may the root invoke `github-commit`. A
bare mode string is not authority.
Standalone `/build` and standalone `/build auto` retain the upstream commit
behavior.

In quick mode, use the active task Context, the user's request, current scope,
and verification evidence as the acceptance baseline; do not require or
generate a spec or plan. Treat one bounded request as the single implementation
slice. Preserve the upstream implementation, test, regression, build, and
commit criteria except for the shared automatic-mode port of the commit actor
and gate.

## Upstream command contract

The following command behavior is preserved from the upstream build command.
MDF state and artifact rules below adapt how this behavior is recorded. In
standalone `/build` and standalone `/build auto`, they do not remove or reorder
the upstream execution steps. In the three automatic modes, the shared
contract intentionally moves the existing commit criterion to the root after
the mandatory build, any applicable simplification, and downstream review
gates. Review-candidate staging occurs between the producer gates and canonical
review; the implementation, verification, and risk checks remain unchanged.

### Modes and arguments

- `/build` implements the next pending task, then stops: one careful slice at a
  time.
- `/build auto` generates the plan if needed, gets one standalone approval,
  and then implements every task without stopping between tasks.
- Treat `auto` (canonical) or `all` as autonomous mode. Anything else (or
  empty) selects the default single-task mode.
- Autonomous mode is not a shorter verification path. It runs the same
  test-driven loop for every task; it only removes the human stepping between
  tasks.

The internal automatic modes do not invoke `/build auto` or `/build all`.
Their current handoff selects exactly one bounded task for the default loop.
None removes RED/GREEN, full regression, build, review, task-owned paths, lock,
or high-risk checks. After the producer gates pass, the root stages the exact
task-owned review-candidate paths for canonical review; only review `PASS`
permits the root-owned commit. This build stage never completes the whole MDF
task.

### Default: one task

For `mode: quick-workflow-pr`, use the current bounded request as the task and
read its acceptance context from the quick handoff and active task card. For
other modes, pick the selected or next pending task from the approved plan. If
the current auto-mode handoff identifies a provisional, repair, or
commit-pending slice, resume that selected slice's recorded stage instead of
selecting another pending task. Then execute this exact sequence:

1. Read the task's acceptance criteria.
2. Load relevant context: existing code, patterns, and types.
3. In `mode: quick-workflow-pr`, documentation-only or static-content changes
   use the applicable project validation instead of inventing a behavioral test.
   For every other mode, and for behavioral changes in quick mode, write a
   failing test for the expected behavior (RED).
4. In `mode: quick-workflow-pr`, documentation-only or static-content changes
   make the smallest scoped edit. For every other mode, and for behavioral
   changes in quick mode, implement the minimum code to pass the test (GREEN).
5. In `mode: quick-workflow-pr`, documentation-only or static-content changes
   use the applicable project validation instead of an invented behavioral test
   suite. For every other mode, and for behavioral changes in quick mode, run
   the full test suite to check for regressions.
6. Run the build to verify compilation for every mode when the project has a
   build step. In quick mode, documentation-only or static-content changes may
   record build/typecheck/lint as not applicable when the changed paths cannot
   affect them; behavioral changes still run the applicable build, typecheck,
   and lint checks.
7. In standalone `/build`, commit with a descriptive message. In every
   automatic mode, stop after implementation and verification with
   implementation-complete provisional evidence; do not stage any path or
   commit here. After the build and any applicable simplification Two-Key gates
   pass, the root stages only the exact task-owned review-candidate paths for
   canonical review; this is not a commit. Canonical review receives the staged
   slice diff, and only its `PASS` permits the root to invoke `github-commit`.
8. In standalone `/build`, preserve the existing selected-task completion
   behavior. In every automatic mode, keep the MDF task active and return the
   provisional bounded result to the root. A provisional result is neither a
   committed plan slice nor whole-task completion.

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
6. Stop and ask the user instead of pushing through when, even in auto mode:
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
   `mode: quick-workflow-pr`, read the current quick handoff and active task
   Context as the acceptance baseline; do not require or generate a spec or
   plan. In all other modes, read the exact approved specification and plan
   revisions and confirm their paths and SHA-256 values are still current. In
   MDF, the approved canonical `.mdf/work/<work-id>/spec-NNN.md` and
   `plan-NNN.md` revisions are the project-equivalent artifacts for the
   upstream spec and plan. They must be traceable to the known spec/plan
   contract above; a README or arbitrary document still cannot satisfy it.
2. Read the task card and current index projection. In quick mode, use the
   current bounded request and active task Context as the single task, confirm
   its owned paths, and use the matching task lock through the approved task
   procedure. In all other modes, choose exactly one selected or next pending
   plan task that is ready, confirm its owned paths and dependencies, and use
   the matching task lock through the approved task procedure. A local
   auto-workflow continuation may use its matching active lock; the PR workflow
   uses the normal task ownership path. Do not infer readiness from card text
   that conflicts with canonical state, a live lock, or the approved scope.
3. Confirm that the current worktree is the locked worktree and the expected
   branch is checked out. The initial slice requires a clean baseline. During
   an automatic-mode repair continuation after a failed build,
   simplification, or canonical review gate, the known provisional diff for
   the same selected task may remain staged or unstaged; verify that it is
   limited to the task-owned paths instead. Stop
   for unrelated dirt, lock conflict, ambiguous ownership, or missing worktree
   setup. This is the MDF equivalent of the upstream autonomous clean-baseline
   guarantee.

### Automatic-mode producer and verification

For all three automatic modes, apply the shared Two-Key lease without
duplicating it:

1. The root supplies the current canonical task, lock, handoff, Git baseline,
   acceptance context, exact leased implementation and test paths, required
   commands, and stop conditions. One bounded producer is the sole writer and
   may write only those leased paths while running exact discovery, this
   adapter, and every applicable primitive above except `code-simplification`.
   The build producer neither loads nor runs simplification. In plan-backed
   automatic modes, the root invokes canonical `code-simplify` as the separate
   simplification stage; quick mode omits it.
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

4. Perform the complete upstream per-task sequence. MDF's focused checks,
   review, and downstream-impact gate are additional checks; they do not stand
   in for the required full test suite or build in `auto-workflow` and
   `auto-workflow-pr`. For those modes, the bounded producer order is:

   `acceptance/context → RED → GREEN → full test suite → build →
   internal review/gates → provisional plan-slice evidence`.

   For quick mode, use the bounded-request sequence:

   `acceptance/context → RED → GREEN (behavioral changes) → applicable
   validation/full regression → build/typecheck/lint when applicable →
   internal review/gates → provisional bounded evidence`.

   After the build gate passes in `auto-workflow` or `auto-workflow-pr`, the
   root invokes canonical `code-simplify` as its own Two-Key stage when
   applicable; quick mode omits simplification. A simplification change
   invalidates affected command and review evidence and re-enters the required
   gates. After the build and any applicable simplification gates return
   `PASS`, the root stages only the exact task-owned review-candidate paths;
   canonical review receives that staged slice or bounded-change diff. This
   staging is not a commit, and only canonical review `PASS` permits
   `github-commit`. Whole MDF task completion is never part of this build
   stage.

5. Review the diff and all verification results against the full
   specification, plan, task acceptance, and relevant project documentation in
   auto modes. In quick mode, use the quick handoff, task Context, bounded
   request, and relevant project documentation instead.
   The producer applies the exact upstream internal review to its actual diff;
   this does not replace the shared independent verifier or the canonical
   downstream `review` stage. Return reasoning and downstream-impact findings
   in provisional evidence; only the root may record canonical MDF notes.
6. Apply the downstream-impact gate in ordinary language. Actionable findings,
   verification regressions, ambiguity, or a scope change must be fixed,
   replanned, or stopped before `PASS` and commit. A clean command result is
   not a substitute for semantic correctness.

### Commit, completion, and artifacts

7. In standalone `/build`, stage only the exact task-owned project paths and
   create one focused commit with a descriptive message. In every automatic
   mode, return provisional evidence without staging any path or committing.
   After the build and any applicable simplification Two-Key gates pass, the
   root may stage only the exact task-owned review-candidate paths. Canonical
   review receives the staged slice or bounded-change diff; review-candidate
   staging is not a commit. Only after canonical review returns `PASS` may the
   root invoke `github-commit` for one focused commit. `.mdf` state is local
   workflow metadata and is not blindly staged as implementation code.
8. In every automatic mode, re-read the card, lock, handoff, index projection,
   and Git state before advancing. This skill does not mark a plan slice
   committed, mark the MDF task `done`, release its lock, push, or mutate a PR.
   Report bounded build status separately from root-owned commit and whole-task
   status.
9. If an automatic-mode plan was generated as a project-visible `tasks/plan.md`,
   preserve the upstream preparatory-commit rule. If the MDF plan adapter
   created only the canonical `.mdf/work/<work-id>/plan-NNN.md` artifact, record
   it in MDF state and do not create an unsynchronized duplicate or stage local
   `.mdf` state as implementation code. This rule does not apply to quick mode.

### Failure and recovery

On a test, verification, or build failure, preserve the evidence and follow the
exact upstream debugging workflow before changing more code. Standalone modes
keep the upstream user stop and resume behavior. Automatic modes use the
shared bounded `REWORK` path for an in-scope, authorized repair and otherwise
finish `BLOCKED`; they do not ask an intermediate question, select a new task,
or assume rollback. Reconcile the actual provisional diff, task-owned paths,
lock, handoff, base, and `HEAD` before a fresh producer cycle.

In plan-backed automatic modes, any spec ambiguity or task decision not
covered by the spec finishes `BLOCKED` rather than prompting during the
unattended run. In quick mode, any acceptance or scope ambiguity finishes
`BLOCKED`. Scope expansion, high-risk or irreversible work, missing authority,
canonical-state mutation, repeated no-progress, or an exhausted three-cycle
bound also finishes `BLOCKED`. A failed or repaired command invalidates the
evidence bound to the prior diff.

### Automatic continuation and final verification

Standalone `/build auto` and `/build all` repeat the same upstream loop over
all approved plan tasks. They are not the auto-workflow loop. In
`mode: auto-workflow` and `mode: auto-workflow-pr`, never enter this whole-plan
mode: the shared contract invokes default single-task `build`, any applicable
simplification, root-owned review-candidate staging, canonical `review` of the
staged slice diff, then root-owned `github-commit` after review `PASS` before
selecting the next slice. Quick mode is one bounded task and does not enter
this plan loop; after its bounded build passes, the root analogously stages the
exact review-candidate paths, passes the staged bounded-change diff to
canonical review, and invokes `github-commit` only after review `PASS`.

After every approved plan task commits in standalone `/build auto` or either
plan-backed automatic mode, run the whole-build verification matrix from the
plan and perform a final review against the full specification. In automatic
modes, those model-led operations use their own shared Two-Key gates. This
final matrix is additive: it does not replace the full test suite and build
required inside each task loop. Report only provisional whole-build evidence;
whole MDF task completion remains root-owned and outside this skill.
