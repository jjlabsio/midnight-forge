const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { ControllerError } = require("./context");
const { verifyAdapterDecision } = require("./adapter");
const { recordDecision, recordInteraction, verifySidecar } = require("./evidence");
const { current, recordEvent } = require("./lifecycle");

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

module.exports = { decideRecovery, recoveryDisposition };
