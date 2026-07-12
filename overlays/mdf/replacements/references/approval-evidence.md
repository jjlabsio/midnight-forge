# MDF Approval Evidence Contract

The canonical approval record is the pair of JSON sidecars produced by the
controller under `.mdf/work/{work_id}/evidence/`: the human approval
`interaction-NNN.json` and its linked `decision-NNN.json`. The decision must
identify the registered artifact and contain `affirmative: true`; the linked
interaction must record a human executor and an explicit affirmative action.
Do not create a duplicate `approval-NNN.md` file or a separate
`latest.approval` pointer.

At approval and at every advance, the controller verifies the
sidecar integrity and input/Git facts, the registered artifact's current byte
hash, and that `item.md.latest.spec` (for spec) or `item.md.latest.plan` (for
plan) exactly names the registered artifact. A changed artifact or latest
pointer therefore invalidates the approval. Artifact existence, a reviewer
pass, or an auto-workflow invocation is not approval.
