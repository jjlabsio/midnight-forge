const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { ControllerError } = require("./context");
const { verifyAdapterDecision } = require("./adapter");
const { recordCommand, recordDecision, recordInteraction, verifyInputs, verifySidecar } = require("./evidence");
const { current, recordEvent, transitionEvidence } = require("./lifecycle");

const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const IMPACTS = new Set(["unaffected", "task-context-updated", "plan-revision-required", "user-decision-required"]);

function git(context, args) {
  const result = spawnSync("git", args, { cwd: context.worktree, encoding: "utf8" });
  if (result.status !== 0) throw new ControllerError("MDF_BUILD_GIT_FAILED", "Could not compute build Git facts.", { args, stderr: result.stderr });
  return result.stdout;
}

function proposedTree(context, paths) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-build-index-"));
  const index = path.join(directory, "index");
  const run = (args) => {
    const result = spawnSync("git", args, { cwd: context.worktree, encoding: "utf8", env: { ...process.env, GIT_INDEX_FILE: index } });
    if (result.status !== 0) throw new ControllerError("MDF_BUILD_GIT_FAILED", "Could not compute proposed commit tree.", { args, stderr: result.stderr });
    return result.stdout.trim();
  };
  try { run(["read-tree", "HEAD"]); run(["add", "-A", "--", ...paths]); return run(["write-tree"]); }
  finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

function statusPaths(context) {
  const output = git(context, ["status", "--porcelain=v1", "-z"]);
  const entries = output.split("\0").filter(Boolean);
  const paths = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const value = entry.slice(3);
    paths.push(value);
    if (entry[0] === "R" || entry[0] === "C" || entry[1] === "R" || entry[1] === "C") paths.push(entries[++index]);
  }
  return [...new Set(paths)].sort();
}

function evidence(context) {
  const directory = path.join(context.work_item.path, "evidence");
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter((file) => file.endsWith(".json")).map((file) => ({ file, value: verifySidecar(context, file, { fresh: false }) }));
}

function planRegistration(context, file) {
  const registration = verifySidecar(context, file, { fresh: false });
  verifyInputs(context, registration);
  if (registration.kind !== "interaction" || registration.invocation?.agent_id !== "mdf-plan" || !Array.isArray(registration.invocation.metadata?.tasks)) throw new ControllerError("MDF_BUILD_PLAN_INVALID", "Build requires an approved plan registration.");
  return registration;
}

function runVerification(context, { attempt_file: attemptFile, command, output_path: outputPath }) {
  const attempt = verifySidecar(context, attemptFile, { fresh: false });
  if (attempt.invocation?.agent_id !== "mdf-build-task-select" || !Array.isArray(command) || command.length === 0 || command.some((part) => typeof part !== "string") || !nonempty(outputPath) || path.isAbsolute(outputPath)) throw new ControllerError("MDF_BUILD_COMMAND_INVALID", "Verification requires a task attempt, argv, and relative output path.");
  const target = path.resolve(context.work_item.path, outputPath);
  const relative = path.relative(context.work_item.path, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`)) throw new ControllerError("MDF_BUILD_COMMAND_INVALID", "Verification output must stay inside the work item.");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const parent = fs.realpathSync(path.dirname(target));
  const parentRelative = path.relative(context.work_item.path, parent);
  if (parentRelative === ".." || parentRelative.startsWith(`..${path.sep}`)) throw new ControllerError("MDF_BUILD_COMMAND_INVALID", "Verification output parent must stay inside the work item.");
  const existing = fs.lstatSync(target, { throwIfNoEntry: false });
  if (existing) throw new ControllerError("MDF_BUILD_COMMAND_INVALID", "Verification output must be a new non-symbolic evidence file.");
  const result = spawnSync(command[0], command.slice(1), { cwd: context.worktree, encoding: "utf8" });
  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  fs.writeFileSync(target, `${result.stdout || ""}${result.stderr || ""}`);
  const evidence = recordCommand(context, { command, output_path: outputPath, exit_code: exitCode });
  const verification = recordInteraction(context, { invocation: { agent_id: "mdf-build-verification", invocation_id: `verify-${attempt.invocation.task.id}-${Date.now()}`, executor: "deterministic-runtime", attempt_file: attemptFile, command_file: evidence.file, exit_code: exitCode }, input_paths: [outputPath, `evidence/${evidence.file}`, `evidence/${attemptFile}`] });
  return { verification_file: verification.file, command_file: evidence.file, exit_code: exitCode };
}

function completedTasks(context, planFile) {
  const referenced = transitionEvidence(context, "build-task", "build-task").flatMap((event) => event.evidence_files);
  return new Set(referenced.map((file) => verifySidecar(context, file, { fresh: false })).filter((value) => value.kind === "decision" && value.conclusion?.kind === "build-task-complete" && value.conclusion?.plan_registration_file === planFile).map((value) => value.conclusion.task_id));
}

function selectBuildTask(context, { plan_registration_file: planFile, selected_task_id: selectedId = null, writer_id: writerId }) {
  if (!nonempty(planFile) || !nonempty(writerId) || (selectedId !== null && !nonempty(selectedId))) throw new ControllerError("MDF_BUILD_INPUT_INVALID", "Task selection requires plan and writer identity.");
  if (current(context).phase !== "build-task") throw new ControllerError("MDF_BUILD_PHASE_INVALID", "Task selection requires build-task phase.");
  const dirty = statusPaths(context);
  if (dirty.length) throw new ControllerError("MDF_BUILD_BASELINE_DIRTY", "Task selection requires a clean baseline.", { paths: dirty });
  const registration = planRegistration(context, planFile);
  const boundTransitions = transitionEvidence(context, "plan", "build-task").filter((event) => event.evidence_files.includes(planFile));
  if (boundTransitions.length !== 1) throw new ControllerError("MDF_BUILD_PLAN_NOT_APPROVED", "Build plan must be the unique plan-to-build transition evidence.");
  const head = git(context, ["rev-parse", "HEAD"]).trim();
  const active = evidence(context).find(({ value }) => value.kind === "interaction" && value.invocation?.agent_id === "mdf-build-task-select" && value.invocation?.base_head === head);
  if (active) throw new ControllerError("MDF_BUILD_MULTI_WRITER", "A task attempt already owns this baseline.", { attempt_file: active.file });
  const complete = completedTasks(context, planFile);
  const ready = registration.invocation.metadata.tasks.filter((task) => !complete.has(task.id) && task.depends_on.every((id) => complete.has(id)));
  const task = selectedId ? ready.find((candidate) => candidate.id === selectedId) : ready[0];
  if (!task) throw new ControllerError("MDF_BUILD_TASK_NOT_READY", "Selected or next task is not uniquely ready.", { selected_task_id: selectedId });
  const attempt = recordInteraction(context, { invocation: { agent_id: "mdf-build-task-select", invocation_id: `build-${task.id}-${Date.now()}`, executor: "deterministic-runtime", writer_id: writerId, plan_registration_file: planFile, task, base_head: head }, input_paths: [`evidence/${planFile}`] });
  return { attempt_file: attempt.file, task, base_head: head };
}

function recordDownstreamImpact(context, { attempt_file: attemptFile, classification, artifact_path: artifactPath }) {
  if (!IMPACTS.has(classification) || !nonempty(artifactPath)) throw new ControllerError("MDF_BUILD_IMPACT_INVALID", "Downstream impact requires an allowed classification and artifact.");
  const attempt = verifySidecar(context, attemptFile, { fresh: false });
  if (attempt.invocation?.agent_id !== "mdf-build-task-select") throw new ControllerError("MDF_BUILD_ATTEMPT_INVALID", "Downstream impact requires a task attempt.");
  const interaction = recordInteraction(context, { invocation: { agent_id: "mdf-downstream-impact", invocation_id: `impact-${attempt.invocation.task.id}-${Date.now()}`, executor: "root", attempt_file: attemptFile, classification }, input_paths: [artifactPath, `evidence/${attemptFile}`] });
  const decision = recordDecision(context, { interaction_file: interaction.file, conclusion: { kind: "downstream-impact", classification, attempt_file: attemptFile, artifact_path: artifactPath } });
  return { impact_file: decision.file };
}

function artifactPath(context, sidecarFile) {
  const sidecar = verifySidecar(context, sidecarFile, { fresh: false });
  if (sidecar.kind !== "artifact") throw new ControllerError("MDF_BUILD_PLAN_INVALID", "Registration artifact reference is invalid.");
  return sidecar.artifact.path;
}

function authorizeTaskCommit(context, request) {
  const { attempt_file: attemptFile, command_files: commandFiles, review_output_path: reviewPath, review_decision_file: reviewFile, task_evidence_path: taskEvidencePath, diff_path: diffPath, downstream_impact_file: impactFile, touched_paths: touchedPaths, commit_subject: subject } = request;
  if (![attemptFile, reviewPath, reviewFile, taskEvidencePath, diffPath, impactFile, subject].every(nonempty) || !Array.isArray(commandFiles) || commandFiles.length === 0 || !Array.isArray(touchedPaths) || touchedPaths.length === 0 || new Set(touchedPaths).size !== touchedPaths.length) throw new ControllerError("MDF_BUILD_EVIDENCE_MISSING", "Commit authorization requires complete task evidence.");
  const attempt = verifySidecar(context, attemptFile, { fresh: false });
  if (attempt.invocation?.agent_id !== "mdf-build-task-select") throw new ControllerError("MDF_BUILD_ATTEMPT_INVALID", "Commit authorization requires a valid task attempt.");
  const baseHead = git(context, ["rev-parse", "HEAD"]).trim();
  if (baseHead !== attempt.invocation.base_head) throw new ControllerError("MDF_BUILD_BASELINE_STALE", "Task baseline changed before commit authorization.");
  const actualPaths = statusPaths(context);
  const expectedPaths = [...touchedPaths].sort();
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths) || expectedPaths.some((file) => !attempt.invocation.task.owned_paths.includes(file))) throw new ControllerError("MDF_BUILD_PATH_SCOPE", "Dirty paths must exactly equal task-owned touched paths.", { actual: actualPaths, expected: expectedPaths });
  const commands = commandFiles.map((file) => { const verification = verifySidecar(context, file); const command = verifySidecar(context, verification.invocation?.command_file); return { file, verification, commandFile: verification.invocation?.command_file, value: command }; });
  if (commands.some(({ verification, value }) => verification.kind !== "interaction" || verification.invocation?.agent_id !== "mdf-build-verification" || verification.invocation.attempt_file !== attemptFile || !verification.git?.worktree_sha256 || value.kind !== "command" || value.exit_code !== 0 || verification.invocation.exit_code !== value.exit_code)) throw new ControllerError("MDF_BUILD_VERIFICATION_FAILED", "Every verification must belong to this attempt, bind worktree content, and pass.");
  const impact = verifySidecar(context, impactFile);
  if (impact.conclusion?.kind !== "downstream-impact" || impact.conclusion.attempt_file !== attemptFile || new Set(["plan-revision-required", "user-decision-required"]).has(impact.conclusion.classification)) throw new ControllerError("MDF_BUILD_IMPACT_BLOCKED", "Downstream impact does not permit a focused commit.");
  const plan = planRegistration(context, attempt.invocation.plan_registration_file);
  const spec = verifySidecar(context, plan.invocation.spec_registration_file, { fresh: false });
  verifyInputs(context, spec);
  const requiredInputs = [artifactPath(context, spec.invocation.artifact_file), artifactPath(context, plan.invocation.artifact_file), taskEvidencePath, diffPath, impact.conclusion.artifact_path, `evidence/${attemptFile}`, `evidence/${impactFile}`, ...commands.flatMap(({ file, commandFile, value }) => [value.output.path, `evidence/${file}`, `evidence/${commandFile}`])].sort();
  const { decision, action } = verifyAdapterDecision(context, reviewFile, { action: "code-review", skill_path: "skills/code-review-and-quality/SKILL.md", persona_path: "agents/code-reviewer.md", output_path: reviewPath });
  const actualInputs = action.inputs.map((input) => input.path).sort();
  if (decision.conclusion?.disposition !== "pass" || JSON.stringify(actualInputs) !== JSON.stringify(requiredInputs)) throw new ControllerError("MDF_BUILD_REVIEW_INVALID", "Fresh review must pass against the exact task evidence set.");
  const expectedTree = proposedTree(context, expectedPaths);
  const authorization = recordInteraction(context, { invocation: { agent_id: "mdf-build-commit-authorization", invocation_id: `commit-${attempt.invocation.task.id}-${Date.now()}`, executor: "deterministic-runtime", attempt_file: attemptFile, plan_registration_file: attempt.invocation.plan_registration_file, task_id: attempt.invocation.task.id, base_head: baseHead, expected_tree: expectedTree, expected_paths: expectedPaths, commit_subject: subject }, input_paths: [...requiredInputs, reviewPath, `evidence/${reviewFile}`] });
  const decisionRecord = recordDecision(context, { interaction_file: authorization.file, conclusion: { kind: "build-task-commit-authorization", attempt_file: attemptFile, task_id: attempt.invocation.task.id, base_head: baseHead, expected_tree: expectedTree, expected_paths: expectedPaths, commit_subject: subject } });
  return { authorization_file: decisionRecord.file };
}

function completeBuildTask(context, { authorization_file: authorizationFile }) {
  const authorization = verifySidecar(context, authorizationFile, { fresh: false });
  if (authorization.conclusion?.kind !== "build-task-commit-authorization") throw new ControllerError("MDF_BUILD_AUTHORIZATION_INVALID", "Task completion requires commit authorization.");
  const interaction = verifySidecar(context, authorization.interaction.file, { fresh: false });
  verifyInputs(context, interaction);
  if (completedTasks(context, interaction.invocation.plan_registration_file).has(authorization.conclusion.task_id)) throw new ControllerError("MDF_BUILD_TASK_DUPLICATE", "Task already has a completion transition.");
  const head = git(context, ["rev-parse", "HEAD"]).trim();
  const fields = git(context, ["show", "-s", "--format=%P%n%T%n%s", head]).trimEnd().split("\n");
  const paths = git(context, ["diff-tree", "--no-commit-id", "--name-only", "-r", head]).trim().split("\n").filter(Boolean).sort();
  if (statusPaths(context).length || fields[0] !== authorization.conclusion.base_head || fields[1] !== authorization.conclusion.expected_tree || fields[2] !== authorization.conclusion.commit_subject || JSON.stringify(paths) !== JSON.stringify(authorization.conclusion.expected_paths)) throw new ControllerError("MDF_BUILD_COMMIT_MISMATCH", "Focused commit facts do not match authorization.", { head, parent: fields[0], tree: fields[1], subject: fields[2], paths });
  const completion = recordInteraction(context, { invocation: { agent_id: "mdf-build-task-complete", invocation_id: `complete-${authorization.conclusion.task_id}-${head}`, executor: "deterministic-runtime", authorization_file: authorizationFile, plan_registration_file: interaction.invocation.plan_registration_file, task_id: authorization.conclusion.task_id, commit: { head, parent: fields[0], tree: fields[1], subject: fields[2], paths } }, input_paths: [`evidence/${authorizationFile}`] });
  const decision = recordDecision(context, { interaction_file: completion.file, conclusion: { kind: "build-task-complete", plan_registration_file: interaction.invocation.plan_registration_file, task_id: authorization.conclusion.task_id, commit: completion.invocation.commit } });
  return recordEvent(context, { event_id: `task-${authorization.conclusion.task_id}-${head}`, from: "build-task", to: "build-task", next_action: "build-task", evidence_files: [decision.file] });
}

module.exports = { authorizeTaskCommit, completeBuildTask, recordDownstreamImpact, runVerification, selectBuildTask };
