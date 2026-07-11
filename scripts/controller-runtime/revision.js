const { ControllerError } = require("./context");
const { verifyAdapterDecision } = require("./adapter");
const { recordArtifact, recordDecision, recordInteraction, verifyInputs, verifySidecar } = require("./evidence");
const { activePlanFile, current, recordEvent } = require("./lifecycle");

function artifactPath(context, file) {
  const artifact = verifySidecar(context, file, { fresh: false });
  if (artifact.kind !== "artifact") throw new ControllerError("MDF_REVISION_SPEC_INVALID", "Spec registration artifact is invalid.");
  return artifact.artifact.path;
}

function registerTechnicalRevision(context, { recovery_file: recoveryFile, original_intent_path: intentPath, prior_spec_registration_file: priorSpecFile, new_spec_path: newSpecPath, review_output_path: reviewPath, review_decision_file: reviewFile }) {
  if (![recoveryFile, intentPath, priorSpecFile, newSpecPath, reviewPath, reviewFile].every((value) => typeof value === "string" && value)) throw new ControllerError("MDF_REVISION_INPUT_INVALID", "Technical revision requires exact intent, recovery, spec, and review evidence.");
  const recovery = verifySidecar(context, recoveryFile);
  const recoveryInteraction = verifySidecar(context, recovery.interaction?.file);
  const wholeRecovery = recovery.conclusion?.whole_build === true && recoveryInteraction.invocation?.agent_id === "mdf-whole-recovery";
  const taskRecovery = recoveryInteraction.invocation?.agent_id === "mdf-recovery" && recoveryInteraction.invocation.attempt_file === recovery.conclusion?.attempt_file;
  if (recovery.conclusion?.kind !== "recovery-decision" || recovery.conclusion.disposition !== "technical-revision" || (!wholeRecovery && !taskRecovery)) throw new ControllerError("MDF_REVISION_RECOVERY_INVALID", "Technical revision requires a current technical-revision recovery decision.");
  const attempt = taskRecovery ? verifySidecar(context, recovery.conclusion.attempt_file, { fresh: false }) : null;
  const planFile = wholeRecovery ? recovery.conclusion.plan_registration_file : attempt.invocation?.plan_registration_file;
  if (activePlanFile(context) !== planFile) throw new ControllerError("MDF_REVISION_GENERATION_INVALID", "Recovery does not belong to the active definition generation.");
  const plan = verifySidecar(context, planFile, { fresh: false });
  const priorSpec = verifySidecar(context, priorSpecFile, { fresh: false });
  verifyInputs(context, priorSpec);
  if (plan.invocation?.agent_id !== "mdf-plan" || plan.invocation.spec_registration_file !== priorSpecFile || priorSpec.invocation?.agent_id !== "mdf-spec") throw new ControllerError("MDF_REVISION_SPEC_INVALID", "Revision prior spec does not match the failed approved plan.");
  const oldSpecPath = artifactPath(context, priorSpec.invocation.artifact_file);
  const expectedInputs = [intentPath, oldSpecPath, newSpecPath, `evidence/${recoveryFile}`, `evidence/${priorSpecFile}`].sort();
  const { decision: review, action } = verifyAdapterDecision(context, reviewFile, { action: "technical-spec-revision", skill_path: "skills/spec-driven-development/SKILL.md", persona_path: "agents/code-reviewer.md", output_path: reviewPath });
  if (JSON.stringify(action.inputs.map((input) => input.path).sort()) !== JSON.stringify(expectedInputs)) throw new ControllerError("MDF_REVISION_REVIEW_INVALID", "Technical revision review must use exact intent, prior spec, failure, and new spec inputs.");
  const semantic = review.conclusion;
  const preserved = Boolean(semantic?.disposition === "pass" && semantic.intent_preserved === true && semantic.external_behavior_changed === false && semantic.scope_changed === false && semantic.material_tradeoff_changed === false && typeof semantic.technical_reason === "string" && semantic.technical_reason.trim());
  const artifact = recordArtifact(context, newSpecPath);
  const interaction = recordInteraction(context, { invocation: { agent_id: "mdf-technical-revision", invocation_id: `revision-${artifact.file}`, executor: "deterministic-runtime", recovery_file: recoveryFile, original_intent_path: intentPath, prior_spec_registration_file: priorSpecFile, new_spec_artifact_file: artifact.file, review_decision_file: reviewFile, intent_preserved: preserved }, input_paths: [...expectedInputs, reviewPath, `evidence/${reviewFile}`] });
  const revision = recordDecision(context, { interaction_file: interaction.file, conclusion: { kind: "technical-spec-revision", recovery_file: recoveryFile, prior_spec_registration_file: priorSpecFile, new_spec_artifact_file: artifact.file, new_spec_path: newSpecPath, intent_preserved: Boolean(preserved), invalidates: ["plan", "build-task", "whole-build", "simplify", "review", "ship", "github-pr"] } });
  const phase = current(context).phase;
  if (!preserved) {
    const stopped = recordEvent(context, { event_id: `revision-stop-${revision.file}`, from: phase, evidence_files: [revision.file], stop_reason: "human-required" });
    return { action: "stop", revision_file: revision.file, ...stopped };
  }
  const transition = recordEvent(context, { event_id: `revision-spec-${revision.file}`, from: phase, to: "spec", next_action: "spec", evidence_files: [revision.file] });
  return { ...transition, action: "spec", revision_file: revision.file, new_spec_artifact_file: artifact.file };
}

module.exports = { registerTechnicalRevision };
