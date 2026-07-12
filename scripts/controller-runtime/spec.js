const { ControllerError, readLatestPointer } = require("./context");
const { recordArtifact, recordDecision, recordInteraction, verifySidecar } = require("./evidence");
const { current, recordEvent } = require("./lifecycle");
const { verifyAdapterDecision } = require("./adapter");

function assertCurrentLatest(context, registration, code) {
  const artifact = verifySidecar(context, registration.invocation?.artifact_file);
  const latest = readLatestPointer(context, "spec");
  if (artifact.kind !== "artifact" || latest !== artifact.artifact.path) {
    throw new ControllerError(code, "Spec approval requires item.md.latest.spec to match the registered artifact.", { latest_pointer: latest, artifact_path: artifact.artifact?.path || null });
  }
}

function registerSpec(context, { artifact_path: artifactPath, review_output_path: reviewPath, review_decision_file: reviewDecisionFile, revision_file: revisionFile = null, mode }) {
  if (!new Set(["standalone", "auto"]).has(mode)) throw new ControllerError("MDF_SPEC_MODE_INVALID", "Spec mode must be standalone or auto.");
  if (!reviewDecisionFile) throw new ControllerError("MDF_SPEC_REVIEW_REQUIRED", "Spec registration requires a provenance-bound DDD review decision.");
  const revisionEvidence = current(context).evidence_files.map((file) => ({ file, value: verifySidecar(context, file) })).find(({ value }) => value.conclusion?.kind === "technical-spec-revision");
  if (revisionEvidence && (revisionFile !== revisionEvidence.file || revisionEvidence.value.conclusion.intent_preserved !== true || revisionEvidence.value.conclusion.new_spec_path !== artifactPath)) throw new ControllerError("MDF_SPEC_REVISION_INVALID", "Technical revision requires its exact new spec artifact.");
  if (!revisionEvidence && revisionFile) throw new ControllerError("MDF_SPEC_REVISION_INVALID", "Unexpected technical revision evidence.");
  const { decision: reviewDecision, execution } = verifyAdapterDecision(context, reviewDecisionFile, { action: "ddd-review", skill_path: "skills/doubt-driven-development/SKILL.md", persona_path: "agents/code-reviewer.md", output_path: reviewPath });
  const reviewedPaths = new Set(execution.inputs?.map((input) => input.path));
  if (reviewDecision.kind !== "decision" || execution.invocation?.adapter_stage !== "executed" || reviewDecision.conclusion?.disposition !== "pass" || !reviewedPaths.has(artifactPath) || !reviewedPaths.has(reviewPath)) throw new ControllerError("MDF_SPEC_REVIEW_INVALID", "Spec review decision is not bound to exact spec and raw review output.");
  const artifact = recordArtifact(context, artifactPath);
  const registration = recordInteraction(context, { invocation: { agent_id: "mdf-spec", invocation_id: `spec-${artifact.file}`, executor: "deterministic-runtime", mode, artifact_file: artifact.file, review_decision_file: reviewDecisionFile, revision_file: revisionFile }, input_paths: [artifactPath, reviewPath, `evidence/${reviewDecisionFile}`, ...(revisionFile ? [`evidence/${revisionFile}`] : [])] });
  return { artifact_file: artifact.file, registration_file: registration.file, mode, action: mode === "standalone" ? "stop" : "approval-required" };
}

function approveSpec(context, { registration_file: registrationFile, user_message_path: userMessagePath, invocation_id: invocationId, affirmative }) {
  if (affirmative !== true) throw new ControllerError("MDF_SPEC_APPROVAL_NOT_AFFIRMATIVE", "Spec approval requires an explicit affirmative human-derived outcome.");
  const registration = verifySidecar(context, registrationFile);
  if (registration.kind !== "interaction" || registration.invocation?.agent_id !== "mdf-spec") throw new ControllerError("MDF_SPEC_REGISTRATION_INVALID", "Spec approval requires a valid registration.");
  assertCurrentLatest(context, registration, "MDF_SPEC_LATEST_POINTER_INVALID");
  const approval = recordInteraction(context, { invocation: { agent_id: "user-approval", invocation_id: invocationId, executor: "human", explicit_affirmative: true, registration_file: registrationFile, artifact_file: registration.invocation.artifact_file }, input_paths: ["item.md", userMessagePath, ...registration.inputs.map((input) => input.path), `evidence/${registrationFile}`] });
  const decision = recordDecision(context, { interaction_file: approval.file, conclusion: { kind: "spec-approval", affirmative: true, registration_file: registrationFile, artifact_file: registration.invocation.artifact_file } });
  return { approval_interaction_file: approval.file, approval_file: decision.file };
}

function advanceSpec(context, { registration_file: registrationFile, approval_file: approvalFile }) {
  const registration = verifySidecar(context, registrationFile);
  if (registration.invocation?.mode === "standalone") return { ok: true, action: "stop", reason: "standalone-spec-complete" };
  if (registration.invocation?.revision_file) {
    const revision = verifySidecar(context, registration.invocation.revision_file);
    const revisedArtifact = verifySidecar(context, revision.conclusion?.new_spec_artifact_file);
    const registeredArtifact = verifySidecar(context, registration.invocation.artifact_file);
    if (revision.conclusion?.kind !== "technical-spec-revision" || revision.conclusion.intent_preserved !== true || revisedArtifact.artifact.path !== registeredArtifact.artifact.path || revisedArtifact.artifact.sha256 !== registeredArtifact.artifact.sha256) throw new ControllerError("MDF_SPEC_REVISION_INVALID", "Automatic spec revision authorization is invalid.");
    assertCurrentLatest(context, registration, "MDF_SPEC_LATEST_POINTER_INVALID");
    if (current(context).phase !== "spec") throw new ControllerError("MDF_SPEC_PHASE_INVALID", "Spec can advance only from spec phase.");
    return recordEvent(context, { event_id: `spec-plan-${registrationFile}`, from: "spec", to: "plan", evidence_files: [registrationFile, registration.invocation.revision_file] });
  }
  if (!approvalFile) return { ok: false, stop: { code: "MDF_SPEC_APPROVAL_REQUIRED", reason: "explicit initial spec approval is required" } };
  const approval = verifySidecar(context, approvalFile);
  if (approval.kind !== "decision" || approval.conclusion?.kind !== "spec-approval" || approval.conclusion?.affirmative !== true || approval.conclusion?.registration_file !== registrationFile || approval.conclusion?.artifact_file !== registration.invocation.artifact_file) throw new ControllerError("MDF_SPEC_APPROVAL_INVALID", "Spec approval does not match current registration.");
  assertCurrentLatest(context, registration, "MDF_SPEC_LATEST_POINTER_INVALID");
  if (current(context).phase !== "spec") throw new ControllerError("MDF_SPEC_PHASE_INVALID", "Spec can advance only from spec phase.");
  return recordEvent(context, { event_id: `spec-plan-${registrationFile}`, from: "spec", to: "plan", evidence_files: [registrationFile, approvalFile] });
}

module.exports = { advanceSpec, approveSpec, registerSpec };
