# MDF Subagent Dispatch Policy

Dispatch, authority, and best-effort requested-routing observation contract for
a root-selected MDF-managed subagent. This reference does not select its model
or effort and is not a runtime selector or controller.

## Prepare a dispatch

1. Resolve the installed plugin root. Before selecting model or effort for any
   MDF-managed subagent request, load and apply
   `<plugin-root>/references/model-routing-5.6.md`.
2. Record one compact dispatch entry in the existing root handoff or synthesis:
   requested model and effort; qualitative selection and effort rationale;
   instruction source and task kind; risk, capability confidence, write scope;
   fallback and degraded status. Do not create a routing artifact.

## Instruction source

| Source | Use | Input |
| --- | --- | --- |
| `skill-backed` | Workflow executor or critic | Exact canonical adapter; the called adapter loads the primitives required by its public contract |
| `persona-backed` | A canonical skill explicitly names a specialist | Exact installed persona prompt, unchanged |

## Dispatch

- Follow `<plugin-root>/references/automatic-operation-contract.md` for
  executor/critic order, authority, acceptance, and rework.
- Keep one writer per shared worktree. Wait for actual terminal responses and
  join required fan-out reports before root synthesis.
- Treat failed, timed-out, interrupted, missing, or incomplete results as
  non-success. Use a visible root fallback only when the caller permits it.
- Preserve ship's canonical parallel specialist fan-out and root merge; do not
  add a retry, cleanup, heartbeat, or orchestration service.

## Canonical roles

Use exactly one role for every MDF-managed dispatch:

| Dispatch | Role |
| --- | --- |
| Read-only codebase inventory | `explorer` |
| Generic testing or reproduction worker | `tester` |
| Generic review | `reviewer` |
| Persona-backed bounded delegation that is not a review or specialist | `persona` |
| Automatic implementation worker | `executor` |
| Automatic workflow critic | `critic` |
| Ship code review specialist | `ship-code-reviewer` |
| Ship security specialist | `ship-security-auditor` |
| Ship testing specialist | `ship-test-engineer` |
| Web performance specialist | `web-performance-auditor` |

No workflow-specific observation format is permitted. A new MDF-managed role
requires an explicit update to this table, helper, and analysis method before
it is dispatched.

## Minimal observation

Before every actual spawn, call `begin` once and retain only its generated
invocation ID. Every call represents one actual dispatch observation and
returns a fresh globally unique ID, including when observation is unavailable.

```bash
node <plugin-root>/references/subagent-dispatch-policy/record-subagent-observation.mjs \
  <canonical-root> begin <work-id-or-dash> <requested-model> \
  <requested-effort> <canonical-role>
```

After an actual terminal response, call `finish` once with only that ID and the
raw status:

```bash
node <plugin-root>/references/subagent-dispatch-policy/record-subagent-observation.mjs \
  <canonical-root> finish <invocation-id> <raw-status>
```

`finish` returns `already_recorded` only for the same ID and raw status, and
reports conflicts diagnostically without adding a row. A lost or unavailable
`begin` observation is not reconstructed or retried for analysis; continue with
the returned usable ID when one is available. The helper never accepts artifact
paths, report content, prompts, responses, secrets, quality scores, or inferred
runtime facts. Requested model and effort are requests, not executed-runtime
facts.

New-format begin rows have no dispatch key. If an immutable historical begin
row contains a `dispatch_key` extra field, ignore it; never rewrite it or use it
for uniqueness, locking, linking, or analysis.

Observation is diagnostic only. A `unavailable` result, a missing event, or an
incomplete pair never blocks or changes spawn, acceptance, retry, commit, or
lifecycle closure. Do not reconstruct it, retry it as a workflow gate, or turn
it into a second dispatch. Preserve the raw limitation for analysis.

Only a malformed command, missing field, or empty/multiline value is a
syntactic input error. After syntactic `begin` parsing, unsafe or unavailable
canonical-root, work, role, journal, or lock facts return `unavailable` with a
usable ID; they are excluded from analysis rather than reconstructed.

## Immutable attempt index

Every task-linked actual dispatch—success, failure, interruption, no report,
or rework—is indexed exactly once in the existing immutable handoff or root
synthesis that already owns that workflow's evidence. An unlinked dispatch
with `work_id: null` is raw requested-routing history and has no attempt index;
never create a synthetic work item or artifact for it. The checker recognizes
immutable `handoff-NNN.md` and `synthesis-NNN.md` artifacts under the linked
work item.
Encode the raw one-line UTF-8 status with unpadded base64url and use this exact
line. The encoding is reversible; never trim, split, or otherwise normalize the
raw status before encoding:

```text
attempt: <id> | role: <canonical-role> | report: <path | none> | status_b64: <base64url(raw-status)> | disposition: <accepted | not_used | unresolved>
```

Use `accepted` only when the root trusts the result as evidence, whether or not
it contains findings. Use `not_used` when the root does not use it, and
`unresolved` when the root has not reached a disposition. A report named in the
index must be project-relative beneath that work item and contain exactly one
`invocation_id: <id>` line. Never rewrite an earlier handoff or
synthesis to add an index.

The analysis-only checker is read-only:

```bash
node <plugin-root>/references/subagent-dispatch-policy/check-subagent-observation-links.mjs \
  <canonical-root>
```

It verifies new-format event pairing, canonical work linkage, one generic
attempt index, reversible raw-status identity, component-safe report paths,
and exact report/ID identity. It never writes a
handoff, report, journal, or workflow state. Legacy observation history stays
immutable and is handled only by the analysis compatibility rules.

## Spawn boundary

```text
model choice: <root-selected candidate>
instruction source: skill-backed | persona-backed
canonical skill: <exact adapter>                       # skill-backed
persona: <exact installed prompt>                      # persona-backed
task input: <bounded target and contract>
```
