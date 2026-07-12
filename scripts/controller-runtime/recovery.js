const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { ControllerError } = require("./context");
const { verifyAdapterDecision } = require("./adapter");
const { recordArtifact, recordDecision, recordInteraction, verifySidecar } = require("./evidence");
const { current, recordEvent } = require("./lifecycle");
const { validateMetadata } = require("./plan");

const REQUIRED = ["reproducible", "intent_unchanged", "reversible", "bounded_scope", "no_human_decision", "ambiguous", "high_risk", "irreversible", "external"];

function recoveryDisposition(judgment) {
  if (!judgment || REQUIRED.some((field) => typeof judgment[field] !== "boolean")) throw new ControllerError("MDF_RECOVERY_JUDGMENT_INVALID", "Recovery judgment requires every automation-boundary field.");
  return judgment.reproducible && judgment.intent_unchanged && judgment.reversible && judgment.bounded_scope && judgment.no_human_decision && !judgment.ambiguous && !judgment.high_risk && !judgment.irreversible && !judgment.external ? "automatic-repair" : "human-required";
}

function priorDecisions(context) {
  const directory = path.join(context.work_item.path, "evidence");
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter((file) => file.endsWith(".json")).map((file) => ({ file, value: verifySidecar(context, file, { fresh: false }) })).filter(({ value }) => value.conclusion?.kind === "recovery-decision");
}

function normalizedFailure(value) {
  if (value.kind === "command") return { kind: value.kind, command: value.command, exit_code: value.exit_code, output_sha256: value.output.sha256 };
  if (value.kind === "artifact") return { kind: value.kind, sha256: value.artifact.sha256 };
  if (value.kind === "decision") { const conclusion = { ...value.conclusion }; delete conclusion.action_id; return { kind: value.kind, conclusion }; }
  return { kind: value.kind, agent_id: value.invocation?.agent_id, action: value.invocation?.action, inputs: value.inputs?.filter((input) => !input.path.startsWith("evidence/")).map((input) => ({ path: input.path, sha256: input.sha256 })) || [] };
}

function decideRecovery(context, { failure_files: failureFiles, reproduction_file: reproductionFile, diagnosis_output_path: diagnosisPath, diagnosis_decision_file: diagnosisFile, attempt_file: attemptFile }) {
  if (!Array.isArray(failureFiles) || failureFiles.length === 0 || new Set(failureFiles).size !== failureFiles.length || ![reproductionFile, diagnosisPath, diagnosisFile, attemptFile].every((value) => typeof value === "string" && value)) throw new ControllerError("MDF_RECOVERY_INPUT_INVALID", "Recovery requires exact failure, reproduction, diagnosis, and task-attempt evidence.");
  const attempt = verifySidecar(context, attemptFile, { fresh: false });
  if (attempt.invocation?.agent_id !== "mdf-build-task-select") throw new ControllerError("MDF_RECOVERY_ATTEMPT_INVALID", "Recovery must target an explicit build task attempt.");
  const failures = failureFiles.map((file) => verifySidecar(context, file));
  const reproduction = verifySidecar(context, reproductionFile);
  if (reproduction.kind !== "command" || reproduction.exit_code === 0) throw new ControllerError("MDF_RECOVERY_NOT_REPRODUCED", "Recovery requires a current failing runtime command.");
  const expectedInputs = [...new Set([...failureFiles, reproductionFile, attemptFile])].map((file) => `evidence/${file}`).sort();
  const { decision: diagnosis, execution, action } = verifyAdapterDecision(context, diagnosisFile, { action: "debug-recovery", skill_path: "skills/debugging-and-error-recovery/SKILL.md", persona_path: "agents/test-engineer.md", output_path: diagnosisPath });
  if (JSON.stringify(action.inputs.map((input) => input.path).sort()) !== JSON.stringify(expectedInputs)) throw new ControllerError("MDF_RECOVERY_DIAGNOSIS_INVALID", "Recovery diagnosis must use the exact current failure inputs.");
  const semantic = diagnosis.conclusion;
  if (!new Set(["automatic-repair", "technical-revision", "human-required"]).has(semantic?.disposition)) throw new ControllerError("MDF_RECOVERY_DIAGNOSIS_INVALID", "Recovery diagnosis disposition is invalid.");
  const boundary = recoveryDisposition(semantic.judgment);
  const fingerprintFacts = { plan_registration_file: attempt.invocation.plan_registration_file, task_id: attempt.invocation.task.id, failures: [...failures, reproduction].map(normalizedFailure).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) };
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify(fingerprintFacts), "utf8").digest("hex");
  const progressMarker = `${execution.git.head}:${execution.git.worktree_sha256}`;
  const repeated = priorDecisions(context).some(({ value }) => value.conclusion.fingerprint === fingerprint && value.conclusion.progress_marker === progressMarker && value.conclusion.disposition === "automatic-repair");
  const disposition = repeated ? "no-progress" : boundary === "human-required" ? "human-required" : semantic.disposition;
  if (disposition === "automatic-repair" && (!Array.isArray(semantic.repair_scope_paths) || semantic.repair_scope_paths.length === 0 || semantic.repair_scope_paths.some((file) => !attempt.invocation.task.owned_paths.includes(file)))) throw new ControllerError("MDF_RECOVERY_SCOPE_INVALID", "Automatic repair must remain inside task-owned scope.");
  const interaction = recordInteraction(context, { invocation: { agent_id: "mdf-recovery", invocation_id: `recovery-${fingerprint}-${Date.now()}`, executor: "deterministic-runtime", attempt_file: attemptFile, diagnosis_decision_file: diagnosisFile, fingerprint, progress_marker: progressMarker, disposition, judgment: semantic.judgment, repair_scope_paths: semantic.repair_scope_paths || [] }, input_paths: [...expectedInputs, diagnosisPath, `evidence/${diagnosisFile}`] });
  const recovery = recordDecision(context, { interaction_file: interaction.file, conclusion: { kind: "recovery-decision", attempt_file: attemptFile, plan_registration_file: attempt.invocation.plan_registration_file, task_id: attempt.invocation.task.id, fingerprint, progress_marker: progressMarker, disposition, judgment: semantic.judgment, repair_scope_paths: semantic.repair_scope_paths || [] } });
  const phase = current(context).phase;
  if (disposition === "no-progress" || disposition === "human-required") {
    const stopped = recordEvent(context, { event_id: `recovery-stop-${recovery.file}`, from: phase, evidence_files: [recovery.file], stop_reason: disposition === "no-progress" ? "no-progress" : "human-required" });
    return { action: "stop", recovery_file: recovery.file, ...stopped };
  }
  if (disposition === "technical-revision") return { action: "technical-revision", recovery_file: recovery.file };
  const transition = recordEvent(context, { event_id: `recovery-repair-${recovery.file}`, from: phase, to: "build-task", next_action: "build-task", evidence_files: [recovery.file] });
  return { ...transition, action: "repair-task", recovery_file: recovery.file, task_id: attempt.invocation.task.id, repair_scope_paths: semantic.repair_scope_paths };
}

function decideWholeBuildRecovery(context, { baseline_file: baselineFile, failure_files: failureFiles, validation_file: validationFile, diagnosis_output_path: diagnosisPath, diagnosis_decision_file: diagnosisFile, synthesis_output_path: synthesisPath, synthesis_decision_file: synthesisFile }) {
  if (!baselineFile || !Array.isArray(failureFiles) || failureFiles.length === 0 || new Set(failureFiles).size !== failureFiles.length || ![validationFile, diagnosisPath, diagnosisFile, synthesisPath, synthesisFile].every((value) => typeof value === "string" && value)) throw new ControllerError("MDF_WHOLE_RECOVERY_INPUT_INVALID", "Whole-build recovery requires exact baseline, failure, validation, diagnosis, and synthesis evidence.");
  const baseline = verifySidecar(context, baselineFile);
  if (baseline.invocation?.agent_id !== "mdf-whole-build") throw new ControllerError("MDF_WHOLE_RECOVERY_BASELINE_INVALID", "Whole-build recovery requires a canonical whole-build baseline.");
  const failures = failureFiles.map((file) => verifySidecar(context, file));
  verifySidecar(context, validationFile);
  const diagnosisInputs = [...new Set([baselineFile, ...failureFiles, validationFile])].map((file) => `evidence/${file}`).sort();
  const { decision: diagnosis, action: diagnosisAction } = verifyAdapterDecision(context, diagnosisFile, { action: "debug-recovery", skill_path: "skills/debugging-and-error-recovery/SKILL.md", persona_path: "agents/test-engineer.md", output_path: diagnosisPath });
  if (JSON.stringify(diagnosisAction.inputs.map((input) => input.path).sort()) !== JSON.stringify(diagnosisInputs)) throw new ControllerError("MDF_WHOLE_RECOVERY_DIAGNOSIS_INVALID", "Whole-build diagnosis must use the exact current failure evidence.");
  const synthesisInputs = [...diagnosisInputs, diagnosisPath, `evidence/${diagnosisFile}`].sort();
  const { decision: synthesis, execution, action: synthesisAction } = verifyAdapterDecision(context, synthesisFile, { action: "recovery-synthesis", skill_path: "skills/debugging-and-error-recovery/SKILL.md", persona_path: "agents/code-reviewer.md", output_path: synthesisPath });
  if (execution.invocation?.executor !== "root" || JSON.stringify(synthesisAction.inputs.map((input) => input.path).sort()) !== JSON.stringify(synthesisInputs)) throw new ControllerError("MDF_WHOLE_RECOVERY_SYNTHESIS_INVALID", "The root orchestrator must synthesize the exact diagnosis evidence.");
  const semantic = synthesis.conclusion;
  const classifications = new Set(["implementation", "plan", "spec", "environment", "ambiguous"]);
  const repairDefects = new Set(["correctness", "acceptance", "regression", "security"]);
  if (!classifications.has(semantic?.classification) || typeof semantic.root_cause_id !== "string" || !semantic.root_cause_id.trim() || typeof semantic.rationale !== "string" || !semantic.rationale.trim() || !Array.isArray(semantic.rejected_findings) || typeof semantic.material_progress !== "boolean" || typeof semantic.spec_intent_preserved !== "boolean" || typeof semantic.requires_user_decision !== "boolean") throw new ControllerError("MDF_WHOLE_RECOVERY_SYNTHESIS_INVALID", "Recovery synthesis must record a reasoned orchestrator classification and stable root cause.");
  const repairable = new Set(["implementation", "plan"]).has(semantic.classification) && semantic.spec_intent_preserved && !semantic.requires_user_decision;
  if (repairable && !repairDefects.has(semantic.defect_kind)) throw new ControllerError("MDF_WHOLE_RECOVERY_SYNTHESIS_INVALID", "Whole-build repair is limited to correctness, acceptance, regression, or security defects.");
  if (repairable && (!Array.isArray(semantic.repair_tasks) || semantic.repair_tasks.length === 0 || semantic.repair_tasks.some((task) => !task || typeof task.id !== "string" || !task.id || !Array.isArray(task.repair_of) || task.repair_of.length === 0 || !Array.isArray(task.depends_on) || !task.repair_of.every((id) => task.depends_on.includes(id)) || !Array.isArray(task.owned_paths) || task.owned_paths.length === 0 || !Array.isArray(task.acceptance) || task.acceptance.length === 0))) throw new ControllerError("MDF_WHOLE_RECOVERY_TASKS_INVALID", "Repairable failures require bounded new canonical repair tasks.");
  const fingerprintFacts = { classification: semantic.classification, root_cause_id: semantic.root_cause_id };
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify(fingerprintFacts), "utf8").digest("hex");
  const repeated = priorDecisions(context).some(({ value }) => value.conclusion.whole_build === true && value.conclusion.fingerprint === fingerprint);
  let disposition = repairable ? "repair-plan" : semantic.classification === "spec" && !semantic.requires_user_decision ? "technical-revision" : "human-required";
  if (repeated || !semantic.material_progress) disposition = "no-progress";
  const interaction = recordInteraction(context, { invocation: { agent_id: "mdf-whole-recovery", invocation_id: `whole-recovery-${fingerprint}-${Date.now()}`, executor: "deterministic-runtime", baseline_file: baselineFile, plan_registration_file: baseline.invocation.plan_registration_file, diagnosis_decision_file: diagnosisFile, synthesis_decision_file: synthesisFile, fingerprint, disposition }, input_paths: [...synthesisInputs, synthesisPath, `evidence/${synthesisFile}`] });
  const recovery = recordDecision(context, { interaction_file: interaction.file, conclusion: { kind: "recovery-decision", whole_build: true, baseline_file: baselineFile, plan_registration_file: baseline.invocation.plan_registration_file, fingerprint, root_cause_id: semantic.root_cause_id, disposition, classification: semantic.classification, defect_kind: semantic.defect_kind || null, rationale: semantic.rationale, rejected_findings: semantic.rejected_findings, repair_tasks: semantic.repair_tasks || [] } });
  if (disposition === "repair-plan") return { action: "repair-plan", recovery_file: recovery.file, repair_tasks: semantic.repair_tasks };
  if (disposition === "technical-revision") return { action: "technical-revision", recovery_file: recovery.file };
  const stopped = recordEvent(context, { event_id: `whole-recovery-stop-${recovery.file}`, from: current(context).phase, evidence_files: [recovery.file], stop_reason: disposition === "no-progress" ? "no-progress" : "human-required" });
  return { action: "stop", recovery_file: recovery.file, ...stopped };
}

function registerRepairPlan(context, { recovery_file: recoveryFile, artifact_path: artifactPath, metadata_file: metadataFile, review_output_path: reviewPath, review_decision_file: reviewFile }) {
  const recovery = verifySidecar(context, recoveryFile);
  if (recovery.conclusion?.kind !== "recovery-decision" || recovery.conclusion.whole_build !== true || recovery.conclusion.disposition !== "repair-plan") throw new ControllerError("MDF_REPAIR_PLAN_RECOVERY_INVALID", "Repair plan requires an approved whole-build recovery decision.");
  const prior = verifySidecar(context, recovery.conclusion.plan_registration_file, { fresh: false });
  const metadataRecord = verifySidecar(context, metadataFile);
  const metadata = metadataRecord.invocation?.metadata;
  validateMetadata(metadata);
  const priorTasks = prior.invocation.metadata.tasks;
  if (metadataRecord.invocation?.agent_id !== "mdf-plan-metadata" || metadataRecord.invocation.spec_registration_file !== prior.invocation.spec_registration_file || JSON.stringify(metadata.tasks.slice(0, priorTasks.length)) !== JSON.stringify(priorTasks) || JSON.stringify(metadata.tasks.slice(priorTasks.length)) !== JSON.stringify(recovery.conclusion.repair_tasks) || JSON.stringify(metadata.whole_build_commands) !== JSON.stringify(prior.invocation.metadata.whole_build_commands)) throw new ControllerError("MDF_REPAIR_PLAN_REVISION_INVALID", "Repair plan must preserve the prior plan and append only diagnosed repair tasks.");
  const expected = [artifactPath, `evidence/${recoveryFile}`, `evidence/${recovery.conclusion.plan_registration_file}`, `evidence/${metadataFile}`].sort();
  const { decision, action } = verifyAdapterDecision(context, reviewFile, { action: "ddd-review", skill_path: "skills/doubt-driven-development/SKILL.md", persona_path: "agents/code-reviewer.md", output_path: reviewPath });
  if (decision.conclusion?.disposition !== "pass" || JSON.stringify(action.inputs.map((input) => input.path).sort()) !== JSON.stringify(expected)) throw new ControllerError("MDF_REPAIR_PLAN_REVIEW_INVALID", "Repair plan requires a passing fresh review of the exact revision.");
  const artifact = recordArtifact(context, artifactPath);
  const baseline = verifySidecar(context, recovery.conclusion.baseline_file);
  const registration = recordInteraction(context, { invocation: { agent_id: "mdf-plan", invocation_id: `repair-plan-${artifact.file}`, executor: "deterministic-runtime", mode: "auto", artifact_file: artifact.file, spec_registration_file: prior.invocation.spec_registration_file, metadata_file: metadataFile, review_decision_file: reviewFile, prior_plan_registration_file: recovery.conclusion.plan_registration_file, recovery_file: recoveryFile, carried_completion_files: baseline.invocation.completion_files, metadata }, input_paths: expected.concat([reviewPath, `evidence/${reviewFile}`]) });
  const transition = recordEvent(context, { event_id: `repair-plan-build-${registration.file}`, from: current(context).phase, to: "build-task", next_action: "build-task", evidence_files: [registration.file, recoveryFile] });
  return { ...transition, registration_file: registration.file, repair_task_ids: recovery.conclusion.repair_tasks.map((task) => task.id) };
}

module.exports = { decideRecovery, decideWholeBuildRecovery, recoveryDisposition, registerRepairPlan };
