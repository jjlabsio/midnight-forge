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

Any implementation or testing delegation must first load the
plugin-installed `../../references/subagent-dispatch-policy.md` and
`../../references/model-routing-5.6.md`. The root classifies difficulty and
risk, verifies a GPT-5.6 candidate at the `high` floor, and passes the selected
dispatch record plus the exact persona prompt through the generic runtime spawn
path. Persona model or effort frontmatter is only a direct-invocation default;
the root-selected dispatch record overrides it for MDF-managed work. Missing capability is an
explicit root fallback with degraded status or a stop; fast, older, and future
profiles are never selected silently.

## Upstream command contract

The following command behavior is preserved from the upstream build command.
MDF state and artifact rules below adapt how this behavior is recorded; they do
not remove or reorder these execution steps.

### Modes and arguments

- `/build` implements the next pending task, then stops: one careful slice at a
  time.
- `/build auto` generates the plan if needed, gets one approval, and then
  implements every task without stopping between tasks.
- Treat `auto` (canonical) or `all` as autonomous mode. Anything else (or
  empty) selects the default single-task mode.
- Autonomous mode is not a shorter verification path. It runs the same
  test-driven loop for every task; it only removes the human stepping between
  tasks.

### Default: one task

Pick the next pending task from the approved plan. Then execute this exact
sequence:

1. Read the task's acceptance criteria.
2. Load relevant context: existing code, patterns, and types.
3. Write a failing test for the expected behavior (RED).
4. Implement the minimum code to pass the test (GREEN).
5. Run the full test suite to check for regressions.
6. Run the build to verify compilation.
7. Commit with a descriptive message.
8. Mark the task complete and stop.

### Autonomous: the whole plan (`/build auto`)

Use this once a spec exists when plan and build should run in one approved pass.
It removes manual stepping between tasks, not verification. Every task still
earns a passing test, the full regression suite, a successful build, its own
commit, and completion status.

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
4. Use one human checkpoint. Present the full plan and wait for an
   unambiguous affirmative such as `approve`, `go`, or `yes`. Hedged responses
   such as “looks reasonable” are not approval. This is the only human gate
   after which the run proceeds autonomously. If `tasks/plan.md` was generated,
   commit it as one preparatory commit before the first task so it cannot bleed
   into that task's commit.
5. Execute every task in dependency order. Use each task's declared
   dependencies; when dependencies are not explicit, use the plan's listed
   order. For each task, run the complete default loop:
   `RED → GREEN → full regression suite → build → commit → mark complete`.
   Stage only the files touched by that task plus its task-status update; never
   use `git add -A` blindly. Make exactly one commit per task so every point
   remains a clean rollback point.
6. Stop and ask the user instead of pushing through when:
   - a test cannot be made to pass or the build breaks without an obvious fix;
     follow `../debugging-and-error-recovery/SKILL.md`;
   - the spec is ambiguous or a task needs a decision not covered by it;
   - a task is high-risk or irreversible, including auth/permission changes,
     destructive data migrations, payments, deletions, deploys, secrets, or
     anything that cannot be undone with `git revert`; follow
     `../doubt-driven-development/SKILL.md` and obtain explicit sign-off.
   After the user resolves a blocker, they re-invoke `/build auto`; it resumes
   from the next pending task.
7. Summarize tasks completed, tests added, commits made, and anything skipped,
   flagged, or left for the user.

If any step fails, follow the exact upstream
`../debugging-and-error-recovery/SKILL.md`.

## MDF/Codex adaptation

These are MDF integration rules. They add state ownership, evidence, and
execution safety around the upstream contract; they do not replace its task
loop or reduce its verification.

### Canonical inputs and task authority

1. Resolve the canonical project root and installed plugin root. Read the exact
   approved specification and plan revisions and confirm their paths and
   SHA-256 values are still current. In MDF, the approved canonical
   `.mdf/work/<work-id>/spec-NNN.md` and `plan-NNN.md` revisions are the
   project-equivalent artifacts for the upstream spec and plan. They must be
   traceable to the known spec/plan contract above; a README or arbitrary
   document still cannot satisfy it.
2. Read the task card and current index projection. Choose exactly one
   selected or next pending task that is ready, confirm its owned paths and
   dependencies, and acquire the task lock through the approved task
   procedure. Do not infer readiness from card text that conflicts with
   canonical state, a live lock, or the approved plan.
3. Confirm that the current worktree is the locked worktree, the expected
   branch is checked out, and the baseline is clean. Stop for unrelated dirt,
   lock conflict, ambiguous ownership, or missing worktree setup. This is the
   MDF equivalent of the upstream autonomous clean-baseline guarantee.

### Execution, verification, and review

4. Perform the complete upstream per-task sequence. MDF's focused checks,
   review, and downstream-impact gate are additional checks; they do not stand
   in for the required full test suite or build. The required order is:

   `acceptance/context → RED → GREEN → full test suite → build → review/gates → commit → complete`

5. Review the diff and all verification results against the full
   specification, plan, task acceptance, and relevant project documentation.
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

7. Stage only the exact task-owned project paths and create one focused commit
   with a descriptive message. The upstream “task-status update” maps to the
   MDF task completion mutation: after the commit, update the canonical card
   and append its index projection through the task owner, recording the commit
   and verification evidence. `.mdf` state is local workflow metadata and is
   not blindly staged into the project commit.
8. Release the lock only after the task handoff is complete, using the exact
   lock-owner and digest checks. Re-read the card and index projection and
   report the commit, full-test result, build result, review result, remaining
   tasks, and any explicit follow-up decision.
9. If the plan was generated as a project-visible `tasks/plan.md`, preserve the
   upstream preparatory-commit rule. If the MDF plan adapter created only the
   canonical `.mdf/work/<work-id>/plan-NNN.md` artifact, record it in MDF state
   and do not create an unsynchronized duplicate or stage local `.mdf` state as
   implementation code.

### Automatic continuation and final verification

`build auto` and `build all` repeat the same upstream loop over all approved
plan tasks. Before each task, recheck approval, exact spec/plan hashes, lock
ownership, clean baseline, dependency readiness, and exact task scope; inspect
`git status --porcelain`, stage with `git add --`, create one commit per task,
complete the task in MDF state, and resume at the next pending task.

After every approved plan task completes, run the whole-build verification
matrix from the plan and perform a final review against the full
specification. This final matrix is additive: it does not replace the full
test suite and build required inside each task loop. Report completion only
after that final review with a readable handoff identifying commits, checks,
completed tasks, and remaining work.
