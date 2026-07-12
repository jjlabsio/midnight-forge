const { ControllerError } = require("./context");
const { verifyAdapterDecision } = require("./adapter");
const { recordArtifact, recordDecision, recordInteraction, verifySidecar } = require("./evidence");
const { current, recordEvent } = require("./lifecycle");
const path = require("path");

function validateMetadata(metadata) {
  if (!metadata || !Array.isArray(metadata.tasks) || metadata.tasks.length === 0) throw new ControllerError("MDF_PLAN_METADATA_INVALID", "Plan metadata requires a complete non-empty task set.");
  if (!Array.isArray(metadata.whole_build_commands) || metadata.whole_build_commands.length === 0 || metadata.whole_build_commands.some((command) => !Array.isArray(command) || command.length === 0 || command.some((part) => typeof part !== "string" || !part))) throw new ControllerError("MDF_PLAN_METADATA_INVALID", "Plan metadata requires a complete ordered whole-build argv matrix.");
  const ids = metadata.tasks.map((task) => task.id);
  if (ids.some((id) => typeof id !== "string" || !id) || new Set(ids).size !== ids.length) throw new ControllerError("MDF_PLAN_TASK_IDS_INVALID", "Plan task IDs must be unique non-empty strings.");
  const known = new Set(ids);
  const pathOwners = new Map();
  for (const task of metadata.tasks) {
    const paths = task.owned_paths;
    const repairs = task.repair_of || [];
    if (!Array.isArray(task.depends_on) || new Set(task.depends_on).size !== task.depends_on.length || task.depends_on.some((id) => !known.has(id) || id === task.id) || !Array.isArray(repairs) || new Set(repairs).size !== repairs.length || repairs.some((id) => !known.has(id) || id === task.id || !task.depends_on.includes(id)) || !Array.isArray(paths) || paths.length === 0 || new Set(paths).size !== paths.length || paths.some((value) => typeof value !== "string" || !value || value.startsWith("/") || value.endsWith("/") || value.includes("\\") || value.split("/").includes("..") || path.posix.normalize(value) !== value || (pathOwners.has(value) && !repairs.includes(pathOwners.get(value)))) || !Array.isArray(task.acceptance) || task.acceptance.length === 0 || task.acceptance.some((value) => typeof value !== "string" || !value.trim())) throw new ControllerError("MDF_PLAN_TASK_MAPPING_INVALID", "Every plan task needs safe dependencies, repair ownership, paths, and non-empty acceptance mapping.");
    paths.forEach((value) => pathOwners.set(value, task.id));
  }
  const visiting = new Set(); const visited = new Set();
  const visit = (id) => { if (visiting.has(id)) throw new ControllerError("MDF_PLAN_DEPENDENCY_CYCLE", "Plan task dependencies contain a cycle."); if (visited.has(id)) return; visiting.add(id); metadata.tasks.find((task) => task.id === id).depends_on.forEach(visit); visiting.delete(id); visited.add(id); };
  ids.forEach(visit);
}

function createPlanMetadata(context, { artifact_path: artifactPath, spec_registration_file: specFile, metadata }) {
  validateMetadata(metadata);
  verifySidecar(context, specFile);
  const sidecar = recordInteraction(context, { invocation: { agent_id: "mdf-plan-metadata", invocation_id: `metadata-${Date.now()}`, executor: "deterministic-runtime", spec_registration_file: specFile, metadata }, input_paths: [artifactPath, `evidence/${specFile}`] });
  return { metadata_file: sidecar.file };
}

function registerPlan(context, { artifact_path: artifactPath, spec_registration_file: specFile, metadata_file: metadataFile, review_output_path: reviewPath, review_decision_file: reviewDecisionFile, mode }) {
  if (!new Set(["standalone", "auto"]).has(mode)) throw new ControllerError("MDF_PLAN_MODE_INVALID", "Plan mode must be standalone or auto.");
  const spec = verifySidecar(context, specFile);
  if (spec.invocation?.agent_id !== "mdf-spec") throw new ControllerError("MDF_PLAN_SPEC_INVALID", "Plan requires a current spec registration.");
  if (!current(context).evidence_files.includes(specFile)) throw new ControllerError("MDF_PLAN_SPEC_MISMATCH", "Plan spec does not match the current spec-to-plan transition.");
  const metadataSidecar = verifySidecar(context, metadataFile);
  if (metadataSidecar.invocation?.agent_id !== "mdf-plan-metadata" || metadataSidecar.invocation.spec_registration_file !== specFile) throw new ControllerError("MDF_PLAN_METADATA_INVALID", "Plan metadata sidecar does not match current spec.");
  validateMetadata(metadataSidecar.invocation.metadata);
  const { decision, execution, action } = verifyAdapterDecision(context, reviewDecisionFile, { action: "ddd-review", skill_path: "skills/doubt-driven-development/SKILL.md", persona_path: "agents/code-reviewer.md", output_path: reviewPath });
  const expectedInputs = [artifactPath, `evidence/${specFile}`, `evidence/${metadataFile}`].sort();
  const actionInputs = action.inputs.map((input) => input.path).sort();
  if (decision.conclusion?.disposition !== "pass" || execution.invocation.output_path !== reviewPath || JSON.stringify(actionInputs) !== JSON.stringify(expectedInputs)) throw new ControllerError("MDF_PLAN_REVIEW_INVALID", "Plan review must pass with exact plan, spec, and metadata inputs and exact raw output.");
  const artifact = recordArtifact(context, artifactPath);
  const registration = recordInteraction(context, { invocation: { agent_id: "mdf-plan", invocation_id: `plan-${artifact.file}`, executor: "deterministic-runtime", mode, artifact_file: artifact.file, spec_registration_file: specFile, metadata_file: metadataFile, review_decision_file: reviewDecisionFile, metadata: metadataSidecar.invocation.metadata }, input_paths: [artifactPath, reviewPath, `evidence/${specFile}`, `evidence/${metadataFile}`, `evidence/${reviewDecisionFile}`] });
  return { artifact_file: artifact.file, registration_file: registration.file, mode, action: mode === "standalone" ? "stop" : "approval-required" };
}

function approvePlan(context, { registration_file: registrationFile, user_message_path: userMessagePath, invocation_id: invocationId, affirmative }) {
  if (affirmative !== true) throw new ControllerError("MDF_PLAN_APPROVAL_NOT_AFFIRMATIVE", "Plan approval requires an explicit affirmative human-derived outcome.");
  const registration = verifySidecar(context, registrationFile);
  if (registration.invocation?.agent_id !== "mdf-plan") throw new ControllerError("MDF_PLAN_REGISTRATION_INVALID", "Plan approval requires a valid registration.");
  const interaction = recordInteraction(context, { invocation: { agent_id: "user-approval", invocation_id: invocationId, executor: "human", explicit_affirmative: true, registration_file: registrationFile, artifact_file: registration.invocation.artifact_file }, input_paths: ["item.md", userMessagePath, ...registration.inputs.map((input) => input.path), `evidence/${registrationFile}`] });
  const decision = recordDecision(context, { interaction_file: interaction.file, conclusion: { kind: "plan-approval", affirmative: true, registration_file: registrationFile, artifact_file: registration.invocation.artifact_file } });
  return { approval_file: decision.file };
}

function advancePlan(context, { registration_file: registrationFile, approval_file: approvalFile }) {
  const registration = verifySidecar(context, registrationFile);
  if (registration.invocation?.mode === "standalone") return { ok: true, action: "stop", reason: "standalone-plan-complete" };
  const specRegistration = verifySidecar(context, registration.invocation.spec_registration_file);
  if (specRegistration.invocation?.revision_file) {
    const revision = verifySidecar(context, specRegistration.invocation.revision_file);
    const revisedArtifact = verifySidecar(context, revision.conclusion?.new_spec_artifact_file);
    const registeredArtifact = verifySidecar(context, specRegistration.invocation.artifact_file);
    if (revision.conclusion?.kind !== "technical-spec-revision" || revision.conclusion.intent_preserved !== true || revisedArtifact.artifact.path !== registeredArtifact.artifact.path || revisedArtifact.artifact.sha256 !== registeredArtifact.artifact.sha256) throw new ControllerError("MDF_PLAN_REVISION_INVALID", "Automatic plan revision authorization is invalid.");
    if (current(context).phase !== "plan") throw new ControllerError("MDF_PLAN_PHASE_INVALID", "Plan can advance only from plan phase.");
    return recordEvent(context, { event_id: `plan-build-${registrationFile}`, from: "plan", to: "build-task", evidence_files: [registrationFile, specRegistration.invocation.revision_file] });
  }
  if (!approvalFile) return { ok: false, stop: { code: "MDF_PLAN_APPROVAL_REQUIRED", reason: "explicit initial plan approval is required" } };
  const approval = verifySidecar(context, approvalFile);
  if (approval.conclusion?.kind !== "plan-approval" || approval.conclusion?.affirmative !== true || approval.conclusion?.registration_file !== registrationFile || approval.conclusion?.artifact_file !== registration.invocation.artifact_file) throw new ControllerError("MDF_PLAN_APPROVAL_INVALID", "Plan approval does not match current registration.");
  if (current(context).phase !== "plan") throw new ControllerError("MDF_PLAN_PHASE_INVALID", "Plan can advance only from plan phase.");
  return recordEvent(context, { event_id: `plan-build-${registrationFile}`, from: "plan", to: "build-task", evidence_files: [registrationFile, approvalFile] });
}

module.exports = { advancePlan, approvePlan, createPlanMetadata, registerPlan, validateMetadata };
