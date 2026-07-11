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
5. From the plugin root, call the production `scripts/mdf-controller.js plan metadata`, then execute
   the exact DDD review with the raw plan, current spec registration, and the
   returned metadata sidecar as bounded inputs. Call `plan register` with that
   provenance-bound review decision. Standalone mode stops on the returned
   action; auto mode uses `plan approve` and `plan advance` only after the
   exact explicit user approval is available.

## Controller payloads

Pass each payload as JSON on stdin while providing the resolved `--cwd` and
`--plugin-root` options:

- `plan metadata`: `artifact_path`, `spec_registration_file`, and structured
  `metadata.tasks` (`id`, `depends_on`, `owned_paths`, `acceptance`).
- `plan register`: `artifact_path`, `spec_registration_file`, returned
  `metadata_file`, `review_output_path`, provenance-bound
  `review_decision_file`, and `mode` (`standalone` or `auto`).
- `plan approve`: `registration_file`, `user_message_path`, `invocation_id`,
  and `affirmative: true`. Supply true only after the root has observed an
  explicit affirmative user action; a negative or ambiguous message is not an
  approval request.
- `plan advance`: current `registration_file` and matching `approval_file`.

## Approval contract

Build requires explicit affirmative user approval of the exact canonical
artifact revision/hash. Follow `../../references/approval-evidence.md` for the
human-facing approval contract and the optional user-facing `approval-NNN.md`
record. The production
controller records the authoritative hash-bound approval sidecars; Markdown
existence or `latest.plan` text is not transition authority. A revision or byte
change must invalidate prior approval.
