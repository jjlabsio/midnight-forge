---
name: plan
description: "Use when the user invokes plan, mdf plan, or asks to create an approved MDF implementation plan."
---

# plan

This is an MDF controller. Resolve the installed plugin root from this loaded
skill before loading paths; unresolved plugin-root references are a validation
failure, not an invitation to invent a path.

1. Require current, explicit approval of the selected spec revision.
2. Load and follow the exact upstream
   `../planning-and-task-breakdown/SKILL.md`, including its ordinary risk
   matrix, early-risk handling, Definition of Done, and sign-off requirements.
   Do not add MDF semantic normal/high-risk classification or evaluator rules.
3. Apply the exact upstream `../doubt-driven-development/SKILL.md` process for
   non-trivial planning decisions. The root agent owns synthesis and artifact
   writes; a generic subagent may receive only the exact selected upstream
   prompt and the bounded review inputs.
4. Save the plan as canonical `plan-NNN.md`, with its ordered task list and
   acceptance criteria, then stop after this phase in standalone mode.
5. From the plugin root, call production `./scripts/mdf-controller.js plan metadata`, then execute
   the exact DDD review with the raw plan, current spec registration, and the
   returned metadata sidecar as bounded inputs. Call `plan register` with that
   provenance-bound review decision. Standalone mode stops on the returned
   action. In the initial generation, auto mode uses `plan approve` and then
   `plan advance` only after exact explicit user approval. In a verified
   technical-revision generation, call `plan advance` without an
   `approval_file`; the spec's revision evidence is the authorization.

## Controller payloads

Pass each payload as JSON on stdin while providing the resolved `--cwd` and
`--plugin-root` options:

- `plan metadata`: `artifact_path`, `spec_registration_file`, and structured
  `metadata.tasks` (`id`, `depends_on`, `owned_paths`, `acceptance`) plus the
  complete ordered shell-free `metadata.whole_build_commands` argv matrix.
- `plan register`: `artifact_path`, `spec_registration_file`, returned
  `metadata_file`, `review_output_path`, provenance-bound
  `review_decision_file`, and `mode` (`standalone` or `auto`).
- `plan approve`: `registration_file`, `user_message_path`, `invocation_id`,
  and `affirmative: true`. Supply true only after the root has observed an
  explicit affirmative user action; a negative or ambiguous message is not an
  approval request.
- `plan advance`: current `registration_file`; include matching `approval_file`
  for the initial generation and omit it for a verified technical revision.

## Approval contract

Initial-generation build requires explicit affirmative user approval of the
exact canonical artifact revision/hash for the plan. Follow
`../../references/approval-evidence.md`: the controller's JSON interaction and
decision sidecars are the canonical approval record, and `item.md.latest.plan`
must name the registered artifact at approval and advance time. Do not create a
duplicate `approval-NNN.md` file. A revision or byte change must invalidate
prior approval.

This human approval is mandatory for the initial plan. After a verified
intent-preserving technical spec revision, the exact revision evidence may
authorize the freshly generated and freshly reviewed plan automatically. It
does not authorize old plan bytes or a different definition generation.
