const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { ControllerError } = require("./context");
const { verifyAdapterDecision } = require("./adapter");
const { recordCommand, recordDecision, recordInteraction, verifyInputs, verifySidecar } = require("./evidence");
const { current, recordEvent, transitionEvidence } = require("./lifecycle");
const { selectBuildTask } = require("./build-task");

const nonempty = (value) => typeof value === "string" && value.trim().length > 0;

function git(context, args) {
  const result = spawnSync("git", args, { cwd: context.worktree, encoding: "utf8" });
  if (result.status !== 0) throw new ControllerError("MDF_WHOLE_BUILD_GIT_FAILED", "Could not compute whole-build Git facts.", { args, stderr: result.stderr });
  return result.stdout.trim();
}

function allEvidence(context) {
  const directory = path.join(context.work_item.path, "evidence");
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter((file) => file.endsWith(".json")).map((file) => ({ file, value: verifySidecar(context, file, { fresh: false }) }));
}

function plan(context, file) {
  const value = verifySidecar(context, file, { fresh: false });
  verifyInputs(context, value);
  if (value.invocation?.agent_id !== "mdf-plan" || !Array.isArray(value.invocation.metadata?.tasks) || transitionEvidence(context, "plan", "build-task").filter((event) => event.evidence_files.includes(file)).length !== 1) throw new ControllerError("MDF_WHOLE_BUILD_PLAN_INVALID", "Whole build requires the uniquely approved plan transition.");
  return value;
}

function completions(context, planFile) {
  return transitionEvidence(context, "build-task", "build-task").flatMap((event) => event.evidence_files.map((file) => ({ event_file: event.file, event: verifySidecar(context, event.file, { fresh: false }), file, value: verifySidecar(context, file, { fresh: false }) }))).filter(({ value }) => value.conclusion?.kind === "build-task-complete" && value.conclusion.plan_registration_file === planFile);
}

function validateCompletion(context, record, planFile) {
  const decision = record.value;
  const completion = verifySidecar(context, decision.interaction.file, { fresh: false });
  const authorization = verifySidecar(context, completion.invocation?.authorization_file, { fresh: false });
  const authorizationInteraction = verifySidecar(context, authorization.interaction?.file, { fresh: false });
  const attempt = verifySidecar(context, authorization.conclusion?.attempt_file, { fresh: false });
  const commit = decision.conclusion?.commit;
  if (completion.invocation?.agent_id !== "mdf-build-task-complete" || completion.invocation.plan_registration_file !== planFile || completion.invocation.task_id !== decision.conclusion.task_id || JSON.stringify(completion.invocation.commit) !== JSON.stringify(commit) || authorization.conclusion?.kind !== "build-task-commit-authorization" || authorizationInteraction.invocation?.agent_id !== "mdf-build-commit-authorization" || authorizationInteraction.invocation.plan_registration_file !== planFile || authorization.conclusion.task_id !== decision.conclusion.task_id || authorization.conclusion.base_head !== commit?.parent || authorization.conclusion.expected_tree !== commit?.tree || authorization.conclusion.commit_subject !== commit?.subject || JSON.stringify(authorization.conclusion.expected_paths) !== JSON.stringify(commit?.paths) || attempt.invocation?.agent_id !== "mdf-build-task-select" || attempt.invocation.plan_registration_file !== planFile || attempt.invocation.task?.id !== decision.conclusion.task_id || attempt.invocation.base_head !== commit?.parent) throw new ControllerError("MDF_WHOLE_BUILD_TASK_PROVENANCE_INVALID", "Task completion is not derived from its exact attempt and commit authorization chain.");
}

function progress(context, planFile) {
  const registration = plan(context, planFile);
  const records = completions(context, planFile);
  const expected = registration.invocation.metadata.tasks.map((task) => task.id);
  const actual = records.map(({ value }) => value.conclusion.task_id);
  if (new Set(actual).size !== actual.length || actual.some((id) => !expected.includes(id))) throw new ControllerError("MDF_WHOLE_BUILD_TASK_SET_INVALID", "Canonical task completion set contains duplicates or unknown tasks.");
  const planTransition = transitionEvidence(context, "plan", "build-task").find((event) => event.evidence_files.includes(planFile));
  const anchor = verifySidecar(context, planTransition.file, { fresh: false }).git.head;
  const seen = new Set();
  for (const record of records) {
    validateCompletion(context, record, planFile);
    const task = registration.invocation.metadata.tasks.find((candidate) => candidate.id === record.value.conclusion.task_id);
    const commit = record.value.conclusion.commit;
    if (task.depends_on.some((id) => !seen.has(id)) || !commit?.head || !commit.parent || !commit.tree || !nonempty(commit.subject) || !Array.isArray(commit.paths) || commit.paths.length === 0 || commit.paths.some((file) => !task.owned_paths.includes(file)) || record.event.git.head !== commit.head) throw new ControllerError("MDF_WHOLE_BUILD_TASK_TRANSITION_INVALID", "Task transition order, ownership, or commit facts are invalid.");
    seen.add(task.id);
  }
  if (records.length && records[0].value.conclusion.commit.parent !== anchor) throw new ControllerError("MDF_WHOLE_BUILD_COMMIT_CHAIN_INVALID", "First focused task commit is not anchored to the approved plan tree.");
  for (let index = 1; index < records.length; index += 1) {
    if (records[index].value.conclusion.commit?.parent !== records[index - 1].value.conclusion.commit?.head) throw new ControllerError("MDF_WHOLE_BUILD_COMMIT_CHAIN_INVALID", "Focused task commits do not form one ordered chain.");
  }
  return { registration, records, expected, actual, pending: expected.filter((id) => !actual.includes(id)) };
}

function resumeAutoBuild(context, { plan_registration_file: planFile, writer_id: writerId }) {
  if (!nonempty(planFile) || !nonempty(writerId) || current(context).phase !== "build-task") throw new ControllerError("MDF_AUTO_BUILD_INPUT_INVALID", "Auto resume requires build-task phase, approved plan, and writer.");
  if (git(context, ["status", "--porcelain"])) throw new ControllerError("MDF_AUTO_BUILD_DIRTY", "Auto resume requires a clean baseline.");
  const state = progress(context, planFile);
  if (state.pending.length === 0) {
    const head = git(context, ["rev-parse", "HEAD"]);
    if (!state.records.length || state.records.at(-1).value.conclusion.commit?.head !== head) throw new ControllerError("MDF_WHOLE_BUILD_TREE_STALE", "Current tree does not match the final focused task commit.");
    return { action: "whole-build", completed_task_ids: state.actual, head };
  }
  const head = git(context, ["rev-parse", "HEAD"]);
  const active = allEvidence(context).filter(({ value }) => value.invocation?.agent_id === "mdf-build-task-select" && value.invocation.base_head === head && value.invocation.plan_registration_file === planFile && !state.actual.includes(value.invocation.task?.id));
  if (active.some(({ value }) => !state.pending.includes(value.invocation.task?.id))) throw new ControllerError("MDF_AUTO_BUILD_STATE_INVALID", "Active attempt does not match a canonical pending task.");
  if (active.length > 1 || (active.length === 1 && active[0].value.invocation.writer_id !== writerId)) throw new ControllerError("MDF_BUILD_MULTI_WRITER", "Canonical resume found a conflicting writer.");
  if (active.length === 1) return { action: "resume-task", attempt_file: active[0].file, task: active[0].value.invocation.task };
  const selected = selectBuildTask(context, { plan_registration_file: planFile, writer_id: writerId });
  return { action: "build-task", ...selected };
}

function beginWholeBuild(context, { plan_registration_file: planFile, writer_id: writerId }) {
  if (!nonempty(writerId)) throw new ControllerError("MDF_WHOLE_BUILD_MATRIX_INVALID", "Whole build requires a writer.");
  const resumed = resumeAutoBuild(context, { plan_registration_file: planFile, writer_id: writerId });
  if (resumed.action !== "whole-build") throw new ControllerError("MDF_WHOLE_BUILD_TASKS_PENDING", "All approved tasks must complete before whole build.", { action: resumed.action });
  const state = progress(context, planFile);
  const commands = state.registration.invocation.metadata.whole_build_commands;
  if (!Array.isArray(commands) || commands.length === 0) throw new ControllerError("MDF_WHOLE_BUILD_MATRIX_INVALID", "Approved plan lacks a complete whole-build matrix.");
  const existing = allEvidence(context).filter(({ value }) => value.invocation?.agent_id === "mdf-whole-build" && value.invocation.head === resumed.head && value.invocation.plan_registration_file === planFile);
  if (existing.length > 1 || (existing.length === 1 && (existing[0].value.invocation.writer_id !== writerId || JSON.stringify(existing[0].value.invocation.commands) !== JSON.stringify(commands)))) throw new ControllerError("MDF_BUILD_MULTI_WRITER", "Whole-build baseline has conflicting ownership or matrix.");
  if (existing.length === 1) return { baseline_file: existing[0].file, commands, head: resumed.head, resumed: true };
  const baseline = recordInteraction(context, { invocation: { agent_id: "mdf-whole-build", invocation_id: `whole-${resumed.head}-${Date.now()}`, executor: "deterministic-runtime", writer_id: writerId, plan_registration_file: planFile, commands, head: resumed.head, task_ids: state.actual, completion_files: state.records.map(({ file }) => file) }, input_paths: [`evidence/${planFile}`, ...state.records.map(({ file }) => `evidence/${file}`)] });
  return { baseline_file: baseline.file, commands, head: resumed.head };
}

function safeOutput(context, outputPath) {
  if (!nonempty(outputPath) || path.isAbsolute(outputPath)) throw new ControllerError("MDF_WHOLE_BUILD_OUTPUT_INVALID", "Whole-build output path must be relative.");
  const target = path.resolve(context.work_item.path, outputPath);
  const relative = path.relative(context.work_item.path, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`)) throw new ControllerError("MDF_WHOLE_BUILD_OUTPUT_INVALID", "Whole-build output escapes work item.");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const parent = fs.realpathSync(path.dirname(target));
  if (path.relative(context.work_item.path, parent).startsWith("..") || fs.lstatSync(target, { throwIfNoEntry: false })) throw new ControllerError("MDF_WHOLE_BUILD_OUTPUT_INVALID", "Whole-build output must be a new file inside work item.");
  return target;
}

function runWholeVerification(context, { baseline_file: baselineFile, index, output_path: outputPath }) {
  const baseline = verifySidecar(context, baselineFile);
  if (baseline.invocation?.agent_id !== "mdf-whole-build" || !Number.isInteger(index) || index < 0 || index >= baseline.invocation.commands.length) throw new ControllerError("MDF_WHOLE_BUILD_MATRIX_INVALID", "Verification index is outside the approved matrix.");
  const prior = allEvidence(context).filter(({ value }) => value.invocation?.agent_id === "mdf-whole-verification" && value.invocation.baseline_file === baselineFile);
  if (prior.some(({ value }) => value.invocation.index === index)) throw new ControllerError("MDF_WHOLE_BUILD_MATRIX_DUPLICATE", "Whole-build matrix index already executed.");
  const successful = prior.filter(({ file, value }) => { if (value.invocation.index >= index) return false; const fresh = verifySidecar(context, file); const command = verifySidecar(context, fresh.invocation.command_file); return fresh.invocation.exit_code === 0 && command.exit_code === 0; }).map(({ value }) => value.invocation.index).sort((a, b) => a - b);
  if (JSON.stringify(successful) !== JSON.stringify(Array.from({ length: index }, (_, value) => value))) throw new ControllerError("MDF_WHOLE_BUILD_MATRIX_ORDER", "Whole-build commands must execute once in approved order.");
  const target = safeOutput(context, outputPath);
  const command = baseline.invocation.commands[index];
  const result = spawnSync(command[0], command.slice(1), { cwd: context.worktree, encoding: "utf8" });
  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  fs.writeFileSync(target, `${result.stdout || ""}${result.stderr || ""}`);
  const commandRecord = recordCommand(context, { command, output_path: outputPath, exit_code: exitCode });
  const verification = recordInteraction(context, { invocation: { agent_id: "mdf-whole-verification", invocation_id: `whole-verify-${index}-${Date.now()}`, executor: "deterministic-runtime", baseline_file: baselineFile, index, command_file: commandRecord.file, exit_code: exitCode }, input_paths: [outputPath, `evidence/${commandRecord.file}`, `evidence/${baselineFile}`] });
  return { verification_file: verification.file, command_file: commandRecord.file, exit_code: exitCode };
}

function artifactPath(context, file) {
  const artifact = verifySidecar(context, file, { fresh: false });
  if (artifact.kind !== "artifact") throw new ControllerError("MDF_WHOLE_BUILD_PLAN_INVALID", "Expected artifact reference.");
  return artifact.artifact.path;
}

function wholeReviewInputs(context, { baseline_file: baselineFile, verification_files: verificationFiles, traceability_path: traceabilityPath }) {
  const baseline = verifySidecar(context, baselineFile);
  if (!Array.isArray(verificationFiles) || verificationFiles.length !== baseline.invocation.commands.length || !nonempty(traceabilityPath)) throw new ControllerError("MDF_WHOLE_BUILD_MATRIX_INCOMPLETE", "Whole-build verification matrix is incomplete.");
  const records = verificationFiles.map((file, index) => {
    const verification = verifySidecar(context, file);
    const command = verifySidecar(context, verification.invocation?.command_file);
    if (verification.invocation?.agent_id !== "mdf-whole-verification" || verification.invocation.baseline_file !== baselineFile || verification.invocation.index !== index || command.exit_code !== 0 || verification.invocation.exit_code !== 0 || JSON.stringify(command.command) !== JSON.stringify(baseline.invocation.commands[index])) throw new ControllerError("MDF_WHOLE_BUILD_VERIFICATION_FAILED", "Ordered whole-build verification is missing, stale, or failed.");
    return { file, verification, command };
  });
  const registration = plan(context, baseline.invocation.plan_registration_file);
  const spec = verifySidecar(context, registration.invocation.spec_registration_file, { fresh: false });
  verifyInputs(context, spec);
  return [artifactPath(context, spec.invocation.artifact_file), artifactPath(context, registration.invocation.artifact_file), traceabilityPath, `evidence/${baselineFile}`, ...baseline.invocation.completion_files.map((file) => `evidence/${file}`), ...records.flatMap(({ file, verification, command }) => [command.output.path, `evidence/${file}`, `evidence/${verification.invocation.command_file}`])].sort();
}

function finalizeWholeBuild(context, { baseline_file: baselineFile, verification_files: verificationFiles, traceability_path: traceabilityPath, review_output_path: reviewPath, review_decision_file: reviewFile }) {
  if (![reviewPath, reviewFile].every(nonempty)) throw new ControllerError("MDF_WHOLE_BUILD_REVIEW_INVALID", "Whole build requires a separate fresh review.");
  const inputs = wholeReviewInputs(context, { baseline_file: baselineFile, verification_files: verificationFiles, traceability_path: traceabilityPath });
  const baseline = verifySidecar(context, baselineFile);
  const { decision, action } = verifyAdapterDecision(context, reviewFile, { action: "code-review", skill_path: "skills/code-review-and-quality/SKILL.md", persona_path: "agents/code-reviewer.md", output_path: reviewPath });
  if (decision.conclusion?.disposition !== "pass" || JSON.stringify(action.inputs.map((input) => input.path).sort()) !== JSON.stringify(inputs)) throw new ControllerError("MDF_WHOLE_BUILD_REVIEW_INVALID", "Whole-build review must pass against exact current inputs.");
  const interaction = recordInteraction(context, { invocation: { agent_id: "mdf-whole-build-stable", invocation_id: `stable-${baseline.invocation.head}-${Date.now()}`, executor: "deterministic-runtime", baseline_file: baselineFile, plan_registration_file: baseline.invocation.plan_registration_file, head: baseline.invocation.head, task_ids: baseline.invocation.task_ids, verification_files: verificationFiles, review_decision_file: reviewFile }, input_paths: [...inputs, reviewPath, `evidence/${reviewFile}`] });
  const stable = recordDecision(context, { interaction_file: interaction.file, conclusion: { kind: "whole-build-stable", baseline_file: baselineFile, plan_registration_file: baseline.invocation.plan_registration_file, head: baseline.invocation.head, task_ids: baseline.invocation.task_ids } });
  return recordEvent(context, { event_id: `whole-${baseline.invocation.head}`, from: "build-task", to: "whole-build", evidence_files: [stable.file] });
}

module.exports = { beginWholeBuild, finalizeWholeBuild, resumeAutoBuild, runWholeVerification, wholeReviewInputs };
