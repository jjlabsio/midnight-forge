const { spawnSync } = require("child_process");
const { ControllerError } = require("./context");
const { verifyAdapterDecision } = require("./adapter");
const { recordDecision, recordInteraction, verifySidecar } = require("./evidence");
const { current, recordEvent, transitionEvidence } = require("./lifecycle");

const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const excluded = (file) => !file.startsWith("scripts/controller-runtime/") || /(^|\/)(__tests__|tests?)(\/|$)|\.(test|spec)\./.test(file);
function git(context, args) { const result = spawnSync("git", args, { cwd: context.worktree, encoding: "utf8" }); if (result.status !== 0) throw new ControllerError("MDF_SIMPLIFY_GIT_FAILED", "Could not compute simplification Git facts."); return result.stdout.trim(); }

function stableRecord(context, file) {
  const stable = verifySidecar(context, file);
  const interaction = verifySidecar(context, stable.interaction?.file);
  if (stable.conclusion?.kind !== "whole-build-stable" || interaction.invocation?.agent_id !== "mdf-whole-build-stable" || !current(context).evidence_files.includes(file)) throw new ControllerError("MDF_SIMPLIFY_BASELINE_INVALID", "Simplification requires the current stable whole-build decision.");
  return { stable, interaction };
}

function createSimplificationScope(context, { stable_file: stableFile }) {
  const { stable, interaction } = stableRecord(context, stableFile);
  const baseline = verifySidecar(context, interaction.invocation.baseline_file, { fresh: false });
  const plan = verifySidecar(context, interaction.invocation.plan_registration_file, { fresh: false });
  const owners = new Map(plan.invocation.metadata.tasks.flatMap((task) => task.owned_paths.map((file) => [file, task.id])));
  const paths = [...new Set(baseline.invocation.completion_files.flatMap((file) => verifySidecar(context, file, { fresh: false }).conclusion.commit.paths))].filter((file) => !excluded(file) && owners.has(file)).sort();
  const scope = recordInteraction(context, { invocation: { agent_id: "mdf-simplification-scope", invocation_id: `scope-${stable.conclusion.head}`, executor: "deterministic-runtime", stable_file: stableFile, plan_registration_file: interaction.invocation.plan_registration_file, head: stable.conclusion.head, eligible: paths.map((file) => ({ path: file, task_id: owners.get(file) })) }, input_paths: [`evidence/${stableFile}`] });
  return { scope_file: scope.file, eligible: scope.invocation.eligible, head: stable.conclusion.head };
}

function registerSimplification(context, { stable_file: stableFile, scope_file: scopeFile, output_path: outputPath, decision_file: decisionFile }) {
  stableRecord(context, stableFile);
  const scope = verifySidecar(context, scopeFile);
  if (scope.invocation?.agent_id !== "mdf-simplification-scope" || scope.invocation.stable_file !== stableFile) throw new ControllerError("MDF_SIMPLIFY_SCOPE_INVALID", "Simplification scope does not match stable build.");
  const { decision, action } = verifyAdapterDecision(context, decisionFile, { action: "code-simplification", skill_path: "skills/code-simplification/SKILL.md", persona_path: "agents/code-reviewer.md", output_path: outputPath });
  const expected = [`evidence/${stableFile}`, `evidence/${scopeFile}`].sort();
  if (JSON.stringify(action.inputs.map((input) => input.path).sort()) !== JSON.stringify(expected) || !new Set(["candidates", "no-change"]).has(decision.conclusion?.disposition) || !Array.isArray(decision.conclusion.candidates)) throw new ControllerError("MDF_SIMPLIFY_DECISION_INVALID", "Simplification decision must use exact scope and structured candidates.");
  const eligible = new Map(scope.invocation.eligible.map((item) => [item.path, item.task_id]));
  if (new Set(decision.conclusion.candidates.map((candidate) => candidate.id)).size !== decision.conclusion.candidates.length || new Set(decision.conclusion.candidates.map((candidate) => candidate.path)).size !== decision.conclusion.candidates.length || (decision.conclusion.disposition === "candidates" && !decision.conclusion.candidates.some((candidate) => candidate.status === "accepted"))) throw new ControllerError("MDF_SIMPLIFY_CANDIDATE_INVALID", "Simplification candidates must be unique and actionable.");
  for (const candidate of decision.conclusion.candidates) {
    if (!nonempty(candidate.id) || !eligible.has(candidate.path) || !new Set(["accepted", "rejected"]).has(candidate.status) || candidate.behavior_preserving !== true || candidate.production !== true || candidate.generated !== false || candidate.public_contract !== false) throw new ControllerError("MDF_SIMPLIFY_CANDIDATE_INVALID", "Candidate must be eligible, production-only, and behavior-preserving.");
  }
  if (decision.conclusion.disposition === "no-change" && decision.conclusion.candidates.some((candidate) => candidate.status === "accepted")) throw new ControllerError("MDF_SIMPLIFY_DECISION_INVALID", "No-change decision cannot contain accepted candidates.");
  const interaction = recordInteraction(context, { invocation: { agent_id: "mdf-simplification", invocation_id: `simplify-${scope.invocation.head}-${Date.now()}`, executor: "deterministic-runtime", stable_file: stableFile, scope_file: scopeFile, plan_registration_file: scope.invocation.plan_registration_file, head: scope.invocation.head, candidates: decision.conclusion.candidates, decision_file: decisionFile }, input_paths: [...expected, outputPath, `evidence/${decisionFile}`] });
  const session = recordDecision(context, { interaction_file: interaction.file, conclusion: { kind: "simplification-session", disposition: decision.conclusion.disposition, stable_file: stableFile, scope_file: scopeFile, plan_registration_file: scope.invocation.plan_registration_file, head: scope.invocation.head, candidates: decision.conclusion.candidates } });
  const transition = recordEvent(context, { event_id: `simplify-${session.file}`, from: "whole-build", to: "simplify", evidence_files: [session.file] });
  return { ...transition, session_file: session.file, candidates: decision.conclusion.candidates };
}

function selectSimplificationCandidate(context, { session_file: sessionFile, candidate_id: candidateId, writer_id: writerId }) {
  const session = verifySidecar(context, sessionFile);
  const candidate = session.conclusion?.candidates?.find((item) => item.id === candidateId);
  if (current(context).phase !== "simplify" || session.conclusion?.kind !== "simplification-session" || candidate?.status !== "accepted" || !nonempty(writerId) || git(context, ["status", "--porcelain"]) || git(context, ["rev-parse", "HEAD"]) !== session.conclusion.head) throw new ControllerError("MDF_SIMPLIFY_CANDIDATE_INVALID", "Accepted candidate requires clean exact simplification baseline.");
  const plan = verifySidecar(context, session.conclusion.plan_registration_file, { fresh: false });
  const taskId = verifySidecar(context, session.conclusion.scope_file, { fresh: false }).invocation.eligible.find((item) => item.path === candidate.path).task_id;
  const task = plan.invocation.metadata.tasks.find((item) => item.id === taskId);
  recordEvent(context, { event_id: `simplify-build-${sessionFile}-${candidateId}`, from: "simplify", to: "build-task", evidence_files: [sessionFile] });
  const attempt = recordInteraction(context, { invocation: { agent_id: "mdf-build-task-select", invocation_id: `simplify-${candidateId}-${Date.now()}`, executor: "deterministic-runtime", writer_id: writerId, plan_registration_file: session.conclusion.plan_registration_file, task, base_head: session.conclusion.head, simplification_of: sessionFile, simplification_candidate_id: candidateId, simplification_scope_paths: [candidate.path] }, input_paths: [`evidence/${sessionFile}`] });
  return { attempt_file: attempt.file, task, candidate, base_head: session.conclusion.head };
}

function authorizeCandidateRejection(context, { attempt_file: attemptFile, failure_files: failureFiles, output_path: outputPath, decision_file: decisionFile }) {
  const attempt = verifySidecar(context, attemptFile, { fresh: false });
  if (current(context).phase !== "build-task" || !nonempty(attempt.invocation?.simplification_of) || !Array.isArray(failureFiles) || failureFiles.length === 0) throw new ControllerError("MDF_SIMPLIFY_REJECTION_INVALID", "Candidate rejection requires selected candidate and failure evidence.");
  failureFiles.forEach((file) => verifySidecar(context, file));
  const expected = [`evidence/${attemptFile}`, ...failureFiles.map((file) => `evidence/${file}`)].sort();
  const { decision, action } = verifyAdapterDecision(context, decisionFile, { action: "simplification-rejection", skill_path: "skills/code-simplification/SKILL.md", persona_path: "agents/code-reviewer.md", output_path: outputPath });
  if (decision.conclusion?.disposition !== "reject" || JSON.stringify(action.inputs.map((input) => input.path).sort()) !== JSON.stringify(expected)) throw new ControllerError("MDF_SIMPLIFY_REJECTION_INVALID", "Candidate rejection must bind exact current failure inputs.");
  const interaction = recordInteraction(context, { invocation: { agent_id: "mdf-simplification-rejection", invocation_id: `reject-${attempt.invocation.simplification_candidate_id}-${Date.now()}`, executor: "deterministic-runtime", attempt_file: attemptFile, session_file: attempt.invocation.simplification_of, candidate_id: attempt.invocation.simplification_candidate_id, baseline_head: attempt.invocation.base_head, decision_file: decisionFile }, input_paths: [...expected, outputPath, `evidence/${decisionFile}`] });
  const rejection = recordDecision(context, { interaction_file: interaction.file, conclusion: { kind: "simplification-rejection-authorized", attempt_file: attemptFile, session_file: attempt.invocation.simplification_of, candidate_id: attempt.invocation.simplification_candidate_id, baseline_head: attempt.invocation.base_head } });
  return { rejection_file: rejection.file, restore_head: attempt.invocation.base_head };
}

function completeCandidateRejection(context, { rejection_file: rejectionFile }) {
  const rejection = verifySidecar(context, rejectionFile, { fresh: false });
  const interaction = verifySidecar(context, rejection.interaction?.file, { fresh: false });
  if (rejection.conclusion?.kind !== "simplification-rejection-authorized" || interaction.invocation?.agent_id !== "mdf-simplification-rejection" || current(context).phase !== "build-task" || git(context, ["status", "--porcelain"]) || git(context, ["rev-parse", "HEAD"]) !== rejection.conclusion.baseline_head) throw new ControllerError("MDF_SIMPLIFY_ROLLBACK_INVALID", "Rejected candidate must restore the exact clean prior baseline.");
  const completion = recordInteraction(context, { invocation: { agent_id: "mdf-simplification-rejected", invocation_id: `rejected-${rejection.conclusion.candidate_id}-${Date.now()}`, executor: "deterministic-runtime", rejection_file: rejectionFile, session_file: rejection.conclusion.session_file, candidate_id: rejection.conclusion.candidate_id, head: rejection.conclusion.baseline_head }, input_paths: [`evidence/${rejectionFile}`] });
  const result = recordDecision(context, { interaction_file: completion.file, conclusion: { kind: "simplification-candidate-rejected", session_file: rejection.conclusion.session_file, candidate_id: rejection.conclusion.candidate_id, head: rejection.conclusion.baseline_head } });
  const transition = recordEvent(context, { event_id: `reject-simplify-${result.file}`, from: "build-task", to: "simplify", evidence_files: [result.file] });
  return { ...transition, rejected_file: result.file };
}

function rejectedIds(context, sessionFile) {
  return new Set(transitionEvidence(context, "build-task", "simplify").flatMap((event) => event.evidence_files).map((file) => verifySidecar(context, file, { fresh: false })).filter((value) => value.conclusion?.kind === "simplification-candidate-rejected" && value.conclusion.session_file === sessionFile).map((value) => value.conclusion.candidate_id));
}

function finalizeNoChange(context, { session_file: sessionFile }) {
  const session = verifySidecar(context, sessionFile);
  const rejections = rejectedIds(context, sessionFile);
  if (current(context).phase !== "simplify" || session.conclusion?.candidates?.some((candidate) => candidate.status === "accepted" && !rejections.has(candidate.id)) || git(context, ["status", "--porcelain"]) || git(context, ["rev-parse", "HEAD"]) !== session.conclusion.head) throw new ControllerError("MDF_SIMPLIFY_NO_CHANGE_INVALID", "No-change/rejected result must retain the verified prior baseline.");
  const rejectionFiles = transitionEvidence(context, "build-task", "simplify").flatMap((event) => event.evidence_files).filter((file) => { const value = verifySidecar(context, file, { fresh: false }); return value.conclusion?.kind === "simplification-candidate-rejected" && value.conclusion.session_file === sessionFile; });
  const expected = [`evidence/${session.conclusion.stable_file}`, `evidence/${session.conclusion.scope_file}`, `evidence/${sessionFile}`, ...rejectionFiles.map((file) => `evidence/${file}`)].sort();
  const stable = verifySidecar(context, session.conclusion.stable_file);
  const stableInteraction = verifySidecar(context, stable.interaction?.file);
  const review = verifySidecar(context, stableInteraction.invocation?.review_decision_file);
  if (stable.conclusion?.kind !== "whole-build-stable" || stableInteraction.invocation?.agent_id !== "mdf-whole-build-stable" || stable.conclusion.head !== session.conclusion.head || review.conclusion?.disposition !== "pass") throw new ControllerError("MDF_SIMPLIFY_NO_CHANGE_INVALID", "No-change requires the exact current whole-build review.");
  const interaction = recordInteraction(context, { invocation: { agent_id: "mdf-simplification-no-change", invocation_id: `no-change-${session.conclusion.head}`, executor: "deterministic-runtime", session_file: sessionFile, stable_file: session.conclusion.stable_file, review_decision_file: stableInteraction.invocation.review_decision_file }, input_paths: [...expected, `evidence/${stableInteraction.invocation.review_decision_file}`] });
  const result = recordDecision(context, { interaction_file: interaction.file, conclusion: { kind: "simplification-no-change", session_file: sessionFile, stable_file: session.conclusion.stable_file, review_file: stableInteraction.invocation.review_decision_file, head: session.conclusion.head } });
  return recordEvent(context, { event_id: `simplify-ship-${result.file}`, from: "simplify", to: "ship", evidence_files: [result.file] });
}

module.exports = { authorizeCandidateRejection, completeCandidateRejection, createSimplificationScope, finalizeNoChange, registerSimplification, selectSimplificationCandidate };
