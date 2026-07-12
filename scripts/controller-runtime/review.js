const { spawnSync } = require("child_process");
const { ControllerError } = require("./context");
const { verifyAdapterDecision } = require("./adapter");
const { recordDecision, recordInteraction, verifyInputs, verifySidecar } = require("./evidence");
const { current, recordEvent, transitionEvidence } = require("./lifecycle");

const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
function git(context, args) { const result = spawnSync("git", args, { cwd: context.worktree, encoding: "utf8" }); if (result.status !== 0) throw new ControllerError("MDF_REVIEW_GIT_FAILED", "Could not compute review Git facts."); return result.stdout.trim(); }
function artifactPath(context, file) { const value = verifySidecar(context, file, { fresh: false }); if (value.kind !== "artifact") throw new ControllerError("MDF_REVIEW_CONTEXT_INVALID", "Review artifact reference is invalid."); return value.artifact.path; }

function createReviewContext(context) {
  if (git(context, ["status", "--porcelain"])) throw new ControllerError("MDF_REVIEW_PHASE_INVALID", "Review context requires a clean worktree.");
  const planEvent = transitionEvidence(context, "plan", "build-task").at(-1);
  const wholeEvent = transitionEvidence(context, "build-task", "whole-build").at(-1);
  const simplifyEvent = transitionEvidence(context, "simplify", "ship").at(-1) || transitionEvidence(context, "simplify", "review").at(-1);
  const planFile = planEvent?.evidence_files.find((file) => verifySidecar(context, file, { fresh: false }).invocation?.agent_id === "mdf-plan");
  const stableFile = wholeEvent?.evidence_files.find((file) => verifySidecar(context, file, { fresh: false }).conclusion?.kind === "whole-build-stable");
  const simplifyFile = simplifyEvent?.evidence_files.find((file) => new Set(["simplification-no-change"]).has(verifySidecar(context, file, { fresh: false }).conclusion?.kind));
  if (!planFile || !stableFile || !simplifyFile) throw new ControllerError("MDF_REVIEW_CONTEXT_INVALID", "Current plan, whole-build, and simplification evidence are required.");
  const plan = verifySidecar(context, planFile, { fresh: false }); verifyInputs(context, plan);
  const spec = verifySidecar(context, plan.invocation.spec_registration_file, { fresh: false }); verifyInputs(context, spec);
  const stable = verifySidecar(context, stableFile);
  const stableInteraction = verifySidecar(context, stable.interaction.file);
  const baseline = verifySidecar(context, stableInteraction.invocation.baseline_file, { fresh: false });
  if (stable.conclusion.head !== git(context, ["rev-parse", "HEAD"])) throw new ControllerError("MDF_REVIEW_TREE_STALE", "Review tree differs from stable whole build.");
  const inputs = [artifactPath(context, spec.invocation.artifact_file), artifactPath(context, plan.invocation.artifact_file), `evidence/${stableFile}`, `evidence/${simplifyFile}`, ...baseline.invocation.completion_files.map((file) => `evidence/${file}`)].sort();
  const reviewContext = recordInteraction(context, { invocation: { agent_id: "mdf-review-context", invocation_id: `review-context-${stable.conclusion.head}`, executor: "deterministic-runtime", plan_registration_file: planFile, spec_registration_file: plan.invocation.spec_registration_file, stable_file: stableFile, simplification_file: simplifyFile, head: stable.conclusion.head, task_ids: stable.conclusion.task_ids }, input_paths: inputs });
  return { context_file: reviewContext.file, input_paths: [...inputs, `evidence/${reviewContext.file}`].sort(), head: stable.conclusion.head };
}

function registerReview(context, { context_file: contextFile, output_path: outputPath, decision_file: decisionFile, mode }) {
  if (!new Set(["standalone", "auto"]).has(mode)) throw new ControllerError("MDF_REVIEW_MODE_INVALID", "Review mode must be standalone or auto.");
  const reviewContext = verifySidecar(context, contextFile);
  if (reviewContext.invocation?.agent_id !== "mdf-review-context" || (mode === "auto" && current(context).phase !== "review")) throw new ControllerError("MDF_REVIEW_CONTEXT_INVALID", "Review decision requires current review context.");
  const expected = [...reviewContext.inputs.map((input) => input.path), `evidence/${contextFile}`].sort();
  const { decision, action } = verifyAdapterDecision(context, decisionFile, { action: "standalone-review", skill_path: "skills/code-review-and-quality/SKILL.md", persona_path: "agents/code-reviewer.md", output_path: outputPath });
  if (!new Set(["pass", "findings"]).has(decision.conclusion?.disposition) || (decision.conclusion.disposition === "findings" && typeof decision.conclusion.human_required !== "boolean") || JSON.stringify(action.inputs.map((input) => input.path).sort()) !== JSON.stringify(expected)) throw new ControllerError("MDF_REVIEW_DECISION_INVALID", "Review decision must bind exact current context and raw report.");
  const semantic = decision.conclusion;
  const interaction = recordInteraction(context, { invocation: { agent_id: "mdf-standalone-review", invocation_id: `review-${reviewContext.invocation.head}-${Date.now()}`, executor: "deterministic-runtime", mode, context_file: contextFile, decision_file: decisionFile, disposition: semantic.disposition }, input_paths: [...expected, outputPath, `evidence/${decisionFile}`] });
  const result = recordDecision(context, { interaction_file: interaction.file, conclusion: { kind: "standalone-review", mode, context_file: contextFile, plan_registration_file: reviewContext.invocation.plan_registration_file, head: reviewContext.invocation.head, disposition: semantic.disposition, human_required: semantic.human_required === true, affected_task_id: semantic.affected_task_id || null, repair_scope_paths: semantic.repair_scope_paths || [] } });
  if (mode === "standalone") return { action: "stop", review_file: result.file, disposition: semantic.disposition };
  if (semantic.disposition === "pass") return { ...recordEvent(context, { event_id: `review-ship-${result.file}`, from: "review", to: "ship", evidence_files: [result.file] }), review_file: result.file };
  if (semantic.human_required === true) return { ...recordEvent(context, { event_id: `review-stop-${result.file}`, from: "review", evidence_files: [result.file], stop_reason: "human-required" }), action: "stop", review_file: result.file };
  const plan = verifySidecar(context, reviewContext.invocation.plan_registration_file, { fresh: false });
  const task = plan.invocation.metadata.tasks.find((candidate) => candidate.id === semantic.affected_task_id);
  if (!task || !Array.isArray(semantic.repair_scope_paths) || semantic.repair_scope_paths.length === 0 || semantic.repair_scope_paths.some((file) => !task.owned_paths.includes(file)) || git(context, ["status", "--porcelain"]) || git(context, ["rev-parse", "HEAD"]) !== reviewContext.invocation.head) throw new ControllerError("MDF_REVIEW_FINDINGS_INVALID", "Automatic review findings require one bounded affected task on current clean tree.");
  recordEvent(context, { event_id: `review-build-${result.file}`, from: "review", to: "build-task", evidence_files: [result.file] });
  const attempt = recordInteraction(context, { invocation: { agent_id: "mdf-build-task-select", invocation_id: `review-repair-${task.id}-${Date.now()}`, executor: "deterministic-runtime", writer_id: "root", plan_registration_file: reviewContext.invocation.plan_registration_file, task, base_head: reviewContext.invocation.head, review_of: result.file, review_scope_paths: semantic.repair_scope_paths }, input_paths: [`evidence/${result.file}`] });
  return { action: "repair-task", review_file: result.file, attempt_file: attempt.file, task, repair_scope_paths: semantic.repair_scope_paths };
}

module.exports = { createReviewContext, registerReview };
