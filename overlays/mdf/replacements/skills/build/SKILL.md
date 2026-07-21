---
name: build
description: "Implement tasks incrementally — build, test, verify, commit. Add \"auto\" to run the whole plan in one approved pass."
---

# build

Build is the upstream incremental implementation command adapted to the MDF
task state model. Resolve the installed plugin root before loading any skill or
reference; an unresolved plugin root is a stop. Load and follow the exact
upstream `../incremental-implementation/SKILL.md` alongside
`../test-driven-development/SKILL.md`. Also load
`../code-review-and-quality/SKILL.md` and any other applicable skill when its
trigger applies.
For `mode: auto-workflow` or `mode: auto-workflow-pr`, also load
`../../references/auto-workflow-contract.md`. In those modes, the shared
contract composes this one-slice implementation stage with a post-build review
and `github-commit`; this skill returns provisional evidence without creating
the slice commit. Standalone `/build` and quick mode retain their normal
commit behavior.
For `mode: quick-workflow-pr`, also load the same contract. In that mode, use
the active task Context, the user's request, current scope, and verification
evidence as the acceptance baseline; do not require or generate a spec or
plan. Preserve the upstream implementation, test, regression, build, and
commit criteria. Treat one bounded request as the single implementation slice.

Any implementation or testing delegation must first load the
plugin-installed `../../references/subagent-dispatch-policy.md` and
`../../references/model-routing-5.6.md`. The root classifies difficulty and
risk, verifies a GPT-5.6 candidate at the `high` floor, and passes the selected
dispatch record plus one resolved instruction source through the generic runtime
spawn path. Automatic build producers and verifiers are `skill-backed`: they
use this exact canonical build adapter and applicable upstream primitives
without a persona. An explicitly named specialist remains `persona-backed` and
requires its exact installed prompt. Persona model or effort frontmatter is
only a direct-invocation default; the root-selected dispatch record overrides it
for MDF-managed work. Missing capability or instruction source is an explicit
root fallback with degraded status or a stop; fast, older, and future profiles
are never selected silently.

## Upstream command contract

The following command behavior is preserved from the upstream build command.
MDF state and artifact rules below adapt how this behavior is recorded. In
standalone `/build` and quick mode, they do not remove or reorder the upstream
execution steps. In the two auto modes, the shared contract intentionally
places the existing commit criterion after the post-build slice review; the
implementation, verification, and risk checks remain unchanged.

### Modes and arguments

- `/build` implements the next pending task, then stops: one careful slice at a
  time.
- `/build auto` generates the plan if needed, gets one standalone approval,
  and then implements every task without stopping between tasks. Inside
  `mode: auto-workflow` or `mode: auto-workflow-pr`, the run-scoped intent and
  exact spec/plan handoff replaces that ceremonial checkpoint.
- Treat `auto` (canonical) or `all` as autonomous mode. Anything else (or
  empty) selects the default single-task mode.
- Autonomous mode is not a shorter verification path. It runs the same
  test-driven loop for every task; it only removes the human stepping between
  tasks.

When called from `mode: auto-workflow` or `mode: auto-workflow-pr`, the root's
run-scoped authorization replaces the standalone plan checkpoint. Neither mode
removes RED/GREEN, full regression, build, review, task-owned staging, lock, or
high-risk checks. Both auto modes commit each plan slice only after the shared
contract's canonical slice review passes and keep the MDF task active;
`auto-workflow-pr` performs whole-task completion only after ship GO and final
PR preflight.

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
7. In standalone `/build` and `mode: quick-workflow-pr`, commit with a
   descriptive message. In `mode: auto-workflow` or `mode: auto-workflow-pr`,
   stop after implementation, verification, and simplification with
   implementation-complete provisional evidence; do not commit here. The
   shared contract invokes canonical `review` and then `github-commit` after
   that review passes.
8. In standalone `/build`, preserve the existing selected-task completion
   behavior. In the auto modes, keep the MDF task active and return the
   provisional slice result to the shared orchestrator. The orchestrator
   records the final slice commit/evidence after review; the PR orchestrator
   performs whole-card completion only after ship GO.

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
4. In standalone `/build auto`, use one human checkpoint: present the full
   plan and wait for an unambiguous affirmative such as `approve`, `go`, or
   `yes`. In `mode: auto-workflow` or `mode: auto-workflow-pr`, verify the exact
   spec/plan hashes and run-scoped authorization instead of asking for this
   ceremonial checkpoint.
   If `tasks/plan.md` was generated, commit it as one preparatory commit before
   the first task so it cannot bleed into that task's commit.
5. Execute every task in dependency order. Use each task's declared
   dependencies; when dependencies are not explicit, use the plan's listed
   order. For each task, run the complete default loop:
   `RED → GREEN → full regression suite → build → review → commit`. Record the
   plan-slice evidence; both auto modes leave the MDF task active for the PR
   orchestrator's final ship-and-handoff completion.
   Stage only files touched by that plan slice; never use `git add -A` blindly
   and never stage a whole-card MDF status update in either auto mode. Make
   exactly one commit per slice so every point remains a clean rollback point.
6. Stop and ask the user instead of pushing through when, even in auto mode:
   - a test cannot be made to pass or the build breaks without an obvious fix;
     follow `../debugging-and-error-recovery/SKILL.md`;
   - the spec is materially ambiguous or a task needs a critical decision not
     covered by it; routine implementation details are decided by the root and
     recorded as assumptions;
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
   an auto-mode repair continuation after a failed canonical slice review, the
   known provisional diff for the same selected task may remain staged or
   unstaged; verify that it is limited to the task-owned paths instead. Stop
   for unrelated dirt, lock conflict, ambiguous ownership, or missing worktree
   setup. This is the MDF equivalent of the upstream autonomous clean-baseline
   guarantee.

### Execution, verification, and review

4. Perform the complete upstream per-task sequence. MDF's focused checks,
   review, and downstream-impact gate are additional checks; they do not stand
   in for the required full test suite or build in auto modes. For auto modes,
   the required order is:

   `acceptance/context → RED → GREEN → full test suite → build → review/gates →
   code-simplify → provisional plan-slice evidence`.

   For quick mode, use the bounded-request sequence:

   `acceptance/context → RED → GREEN (behavioral changes) → applicable
   validation/full regression → build/typecheck/lint when applicable → review →
   commit`.

   Quick mode omits plan-slice evidence and code-simplify. Whole MDF task
   completion is not part of the build slice; the quick PR handoff completes it
   only after review and final preflight.

5. Review the diff and all verification results against the full
   specification, plan, task acceptance, and relevant project documentation in
   auto modes. In quick mode, use the quick handoff, task Context, bounded
   request, and relevant project documentation instead.
   Record readable Markdown notes in the work item when reasoning or
   downstream impact needs to be preserved. Aim for a fresh-context upstream
   code review when an independent reviewer is available; if unavailable,
   perform and disclose a root review rather than claiming independent
   freshness.
6. Apply the downstream-impact gate in ordinary language. Actionable findings,
   verification regressions, ambiguity, or a scope change must be fixed,
   replanned, or stopped before commit. A clean command result is not a
   substitute for semantic correctness.

### Commit, completion, and artifacts

7. In standalone `/build` and quick mode, stage only the exact task-owned
   project paths and create one focused commit with a descriptive message. In
   auto modes, invoke canonical `github-commit` only after the shared
   post-build slice review passes; stage only that slice's paths and record the
   commit, verification result, review result, and final slice evidence. In
   `mode: auto-workflow`, do not mark the MDF task done or release its active
   lock; the lock remains owned for continuation. In
   `mode: auto-workflow-pr`, the orchestrator performs task completion after
   ship GO and final preflight. In quick mode, task completion occurs after the
   review loop and final PR preflight. `.mdf` state is local workflow metadata
   and is not blindly staged into the project commit.
8. Re-read the card and index projection. Auto modes report plan-slice and
   whole-task completion separately; quick mode reports the bounded request's
   build/review completion and whole-task completion separately. The PR
   workflows may complete an active task immediately before push/PR handoff.
9. If an auto-mode plan was generated as a project-visible `tasks/plan.md`,
   preserve the upstream preparatory-commit rule. If the MDF plan adapter
   created only the canonical `.mdf/work/<work-id>/plan-NNN.md` artifact, record
   it in MDF state and do not create an unsynchronized duplicate or stage local
   `.mdf` state as implementation code. This rule does not apply to quick mode.

### Automatic continuation and final verification

Standalone `/build auto` and `/build all` repeat the same upstream loop over
all approved plan tasks. They are not the auto-workflow loop. In
`mode: auto-workflow` and `mode: auto-workflow-pr`, never enter this whole-plan
mode: the shared contract invokes default single-task `build`, then canonical
`review`, then `github-commit` before selecting the next slice. Quick mode is
one bounded task and does not enter this plan loop.

After every approved plan task completes, run the whole-build verification
matrix from the plan and perform a final review against the full
specification. This final matrix is additive: it does not replace the full
test suite and build required inside each task loop. Report completion only
after that final review with a readable handoff identifying commits, checks,
completed tasks, and remaining work.
