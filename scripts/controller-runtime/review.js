const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { ControllerError, resolveReviewControllerContext } = require("./context");
const { verifyAdapterDecision } = require("./adapter");
const { recordDecision, recordInteraction, resolveRemoteBase, verifyInputs, verifySidecar } = require("./evidence");
const { current, recordEvent, transitionEvidence } = require("./lifecycle");

const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const DIRECT_PRODUCERS = new Set(["mdf-build-verification", "mdf-direct-verification"]);
const LIFECYCLE_PRODUCERS = new Set([
  "mdf-lifecycle", "mdf-spec", "mdf-plan", "mdf-plan-metadata", "mdf-build-task-select",
  "mdf-build-task-complete", "mdf-build-commit-authorization", "mdf-whole-build",
  "mdf-whole-verification", "mdf-whole-build-stable", "mdf-simplification",
  "mdf-simplification-scope", "mdf-simplification-rejection", "mdf-simplification-rejected",
  "mdf-simplification-no-change",
]);
const LIFECYCLE_DECISIONS = new Set([
  "spec-approval", "plan-approval", "build-task-complete", "build-task-repair-complete",
  "build-task-simplification-complete", "build-task-review-repair-complete", "whole-build-stable",
  "simplification-session", "simplification-rejection-authorized", "simplification-candidate-rejected",
]);

function git(context, args, code = "MDF_REVIEW_GIT_CONTEXT_FAILED", message = "Could not compute review Git facts.") {
  const result = spawnSync("git", args, { cwd: context.worktree, encoding: "utf8" });
  if (result.status !== 0) throw new ControllerError(code, message, { args, stderr: result.stderr });
  return result.stdout.trim();
}

function artifactPath(context, file) {
  const value = verifySidecar(context, file, { fresh: false });
  if (value.kind !== "artifact") throw new ControllerError("MDF_REVIEW_CONTEXT_INVALID", "Review artifact reference is invalid.");
  return value.artifact.path;
}

function taskProvenance(context) {
  return {
    task_id: context.task?.task_id || context.lock?.task_id || null,
    work_id: context.task?.work_id || context.lock?.work_id || context.work_item.id,
    task_card_sha256: context.task?.card_sha256 || null,
    canonical_root: context.canonical_root,
    worktree: context.worktree,
    branch: context.task?.branch || context.lock?.branch || git(context, ["branch", "--show-current"]),
    lock_path: context.lock?.path || null,
    lock: context.lock ? {
      task_id: context.lock.task_id,
      work_id: context.lock.work_id,
      canonical_root: context.lock.canonical_root,
      worktree: context.lock.worktree,
      branch: context.lock.branch,
      started: context.lock.started,
      runtime: context.lock.runtime,
    } : null,
  };
}

function createLifecycleReviewContext(context) {
  if (git(context, ["status", "--porcelain"])) throw new ControllerError("MDF_REVIEW_PHASE_INVALID", "Review context requires a clean worktree.");
  const planEvent = transitionEvidence(context, "plan", "build-task").at(-1);
  const wholeEvent = transitionEvidence(context, "build-task", "whole-build").at(-1);
  const simplifyEvent = transitionEvidence(context, "simplify", "ship").at(-1) || transitionEvidence(context, "simplify", "review").at(-1);
  const planFile = planEvent?.evidence_files.find((file) => verifySidecar(context, file, { fresh: false }).invocation?.agent_id === "mdf-plan");
  const stableFile = wholeEvent?.evidence_files.find((file) => verifySidecar(context, file, { fresh: false }).conclusion?.kind === "whole-build-stable");
  const simplifyFile = simplifyEvent?.evidence_files.find((file) => new Set(["simplification-no-change"]).has(verifySidecar(context, file, { fresh: false }).conclusion?.kind));
  if (!planFile || !stableFile || !simplifyFile) throw new ControllerError("MDF_REVIEW_CONTEXT_INVALID", "Current plan, whole-build, and simplification evidence are required.");
  const plan = verifySidecar(context, planFile, { fresh: false });
  verifyInputs(context, plan);
  const spec = verifySidecar(context, plan.invocation.spec_registration_file, { fresh: false });
  verifyInputs(context, spec);
  const stable = verifySidecar(context, stableFile);
  const stableInteraction = verifySidecar(context, stable.interaction.file);
  const baseline = verifySidecar(context, stableInteraction.invocation.baseline_file, { fresh: false });
  const simplifySession = simplifyFile ? verifySidecar(context, verifySidecar(context, simplifyFile, { fresh: false }).conclusion?.session_file, { fresh: false }) : null;
  const simplifyInteraction = simplifyFile ? verifySidecar(context, simplifyFile, { fresh: false }).interaction : null;
  if (stable.conclusion.head !== git(context, ["rev-parse", "HEAD"])) throw new ControllerError("MDF_REVIEW_TREE_STALE", "Review tree differs from stable whole build.");
  const provenance = taskProvenance(context);
  const inputs = lifecycleInputs(context, { planFile, plan, spec, stableFile, stable, stableInteraction, baseline, simplifyFile, simplifySession, simplifyInteraction, planEvent, wholeEvent, simplifyEvent });
  const reviewContext = recordInteraction(context, {
    invocation: {
      agent_id: "mdf-review-context",
      invocation_id: `review-context-${stable.conclusion.head}`,
      executor: "deterministic-runtime",
      review_mode: "lifecycle-review",
      ...provenance,
      plan_registration_file: planFile,
      spec_registration_file: plan.invocation.spec_registration_file,
      stable_file: stableFile,
      simplification_file: simplifyFile,
      lifecycle_inputs: inputs,
      head: stable.conclusion.head,
      task_ids: stable.conclusion.task_ids,
    },
    input_paths: inputs,
  });
  return { context_file: reviewContext.file, input_paths: [...inputs, `evidence/${reviewContext.file}`].sort(), head: stable.conclusion.head, review_mode: "lifecycle-review" };
}

function lifecycleMarker(context, file) {
  let value;
  try {
    value = verifySidecar(context, file, { fresh: false });
  } catch (error) {
    return { present: true, invalid: file };
  }
  const producer = value.invocation?.agent_id;
  const decision = value.conclusion?.kind;
  return { present: LIFECYCLE_PRODUCERS.has(producer) || LIFECYCLE_DECISIONS.has(decision), invalid: null };
}

function lifecycleEvidencePresent(context) {
  const directory = path.join(context.work_item.path, "evidence");
  if (!fs.existsSync(directory)) return { present: false, invalid: null };
  const rootStat = fs.lstatSync(directory);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) return { present: true, invalid: "evidence" };
  const files = [];
  const visit = (current, relative = "") => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(current, entry.name);
      const child = relative ? path.join(relative, entry.name) : entry.name;
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        files.push({ file: child, invalid: `evidence/${child}` });
      } else if (stat.isDirectory()) {
        visit(absolute, child);
      } else if (stat.isFile() && entry.name.endsWith(".json")) {
        files.push({ file: child, invalid: null });
      }
    }
  };
  visit(directory);
  for (const entry of files) {
    if (entry.invalid) return { present: true, invalid: entry.invalid };
    const marker = lifecycleMarker(context, entry.file);
    if (marker.present) return marker;
  }
  return { present: false, invalid: null };
}

function verificationPaths(value) {
  if (!Array.isArray(value) || value.length === 0 || new Set(value).size !== value.length || value.some((file) => typeof file !== "string" || !/^evidence\/verification-\d{3}\.json$/.test(file))) {
    throw new ControllerError("MDF_REVIEW_EVIDENCE_PATH_INVALID", "Direct review requires unique canonical verification-NNN evidence paths.", { verification_files: value });
  }
  return [...value].sort();
}

function baseFacts(context) {
  return resolveRemoteBase(context, "MDF_REVIEW_BASE_INVALID");
}

function diffSnapshot(context, baseCommit, head, { write = true } = {}) {
  const result = spawnSync("git", ["diff", "--binary", baseCommit, head], { cwd: context.worktree, encoding: null });
  if (result.status !== 0) throw new ControllerError("MDF_REVIEW_DIFF_FAILED", "Could not capture the direct review diff.", { stderr: result.stderr });
  const bytes = result.stdout || Buffer.alloc(0);
  const relative = `review-diff-${head.slice(0, 12)}.patch`;
  const target = path.join(context.work_item.path, relative);
  if (fs.existsSync(target)) {
    if (!Buffer.from(fs.readFileSync(target)).equals(bytes)) throw new ControllerError("MDF_REVIEW_INPUT_STALE", "Existing direct review diff snapshot does not match the current Git diff.", { path: relative });
  } else if (write) {
    fs.writeFileSync(target, bytes, { flag: "wx" });
  } else {
    throw new ControllerError("MDF_REVIEW_INPUT_STALE", "Direct review diff snapshot is missing.", { path: relative });
  }
  return { path: relative, sha256: crypto.createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length };
}

function freshVerification(context, file, expected) {
  const verificationFile = file.replace(/^evidence\//, "");
  let verification;
  try {
    verification = verifySidecar(context, verificationFile);
  } catch (error) {
    if (["MDF_EVIDENCE_STALE", "MDF_EVIDENCE_PATH_MISSING", "MDF_EVIDENCE_REPLAY"].includes(error.code)) throw new ControllerError("MDF_REVIEW_INPUT_STALE", "Direct verification evidence is stale, missing, or foreign.", { file, cause: error.message });
    throw new ControllerError("MDF_REVIEW_VERIFICATION_INVALID", "Direct verification evidence is invalid.", { file, cause: error.message });
  }
  const invocation = verification.invocation;
  if (verification.kind !== "interaction" || !DIRECT_PRODUCERS.has(invocation?.agent_id) || invocation.executor !== "deterministic-runtime" || invocation.exit_code !== 0 || !invocation.command_file || invocation.task_id !== expected.task_id || invocation.work_id !== expected.work_id || invocation.canonical_root !== expected.canonical_root || invocation.worktree !== expected.worktree || invocation.branch !== expected.branch || invocation.base_commit !== expected.base_commit || invocation.head !== expected.head) {
    throw new ControllerError("MDF_REVIEW_PRODUCER_INVALID", "Direct verification producer or Git/task provenance does not match the review context.", { file, expected, actual: invocation });
  }
  let command;
  try { command = verifySidecar(context, invocation.command_file); } catch (error) {
    if (["MDF_EVIDENCE_STALE", "MDF_EVIDENCE_PATH_MISSING"].includes(error.code)) throw new ControllerError("MDF_REVIEW_INPUT_STALE", "Linked direct verification command or output changed after context resolution.", { file, command_file: invocation.command_file, cause: error.message });
    throw new ControllerError("MDF_REVIEW_VERIFICATION_INVALID", "Linked direct verification command evidence is invalid.", { file, command_file: invocation.command_file, cause: error.message });
  }
  if (command.kind !== "command" || !Array.isArray(command.command) || command.command.length === 0 || command.command.some((part) => typeof part !== "string") || command.exit_code !== 0 || command.output?.path === undefined) throw new ControllerError("MDF_REVIEW_VERIFICATION_INVALID", "Direct verification command did not pass a valid argv or output contract.", { file, command_file: invocation.command_file });
  return { file, invocation, command_file: invocation.command_file, command: command.command, output: command.output };
}

function sameFacts(expected, actual, code = "MDF_REVIEW_INPUT_STALE") {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new ControllerError(code, "Review provenance no longer matches the current task or Git facts.", { expected, actual });
}

function refreshTaskProvenance(context, recorded) {
  const marker = path.join(context.canonical_root, ".mdf", "project", "init.json");
  if (!fs.existsSync(marker)) throw new ControllerError("MDF_REVIEW_INPUT_STALE", "Canonical MDF project state disappeared before review registration.", { path: marker });
  let fresh;
  try {
    fresh = resolveReviewControllerContext({ cwd: context.worktree, pluginRoot: context.plugin_root });
  } catch (error) {
    throw new ControllerError("MDF_REVIEW_INPUT_STALE", "Current review task or lock facts can no longer be resolved.", { cause: error.message, code: error.code });
  }
  sameFacts({ task_id: recorded.task_id, work_id: recorded.work_id, task_card_sha256: recorded.task_card_sha256, canonical_root: recorded.canonical_root, worktree: recorded.worktree, branch: recorded.branch, lock_path: recorded.lock_path, lock: recorded.lock }, taskProvenance(fresh));
}

function revalidateDirectReview(context, reviewContext) {
  const recorded = reviewContext.invocation;
  refreshTaskProvenance(context, recorded);
  const base = baseFacts(context);
  sameFacts({ base_ref: recorded.base_ref, base_commit: recorded.base_commit }, base);
  const head = git(context, ["rev-parse", "HEAD"]);
  if (head !== recorded.head) throw new ControllerError("MDF_REVIEW_INPUT_STALE", "Reviewed HEAD changed after direct context resolution.", { expected: recorded.head, actual: head });
  const diff = diffSnapshot(context, base.base_commit, head, { write: false });
  sameFacts({ path: recorded.diff_path, sha256: recorded.diff_sha256, bytes: recorded.diff_bytes }, diff);
  const expected = { task_id: recorded.task_id, work_id: recorded.work_id, canonical_root: recorded.canonical_root, worktree: recorded.worktree, branch: recorded.branch, base_commit: base.base_commit, head };
  const files = verificationPaths(recorded.verification_files);
  const verifications = files.map((file) => freshVerification(context, file, expected));
  sameFacts(recorded.verification_outputs, verifications.map(({ file, command_file, command, output }) => ({ file, command_file, command, output })));
}

function collectSidecarGraph(context, roots) {
  const paths = new Set(["item.md"]);
  const queue = roots.filter(Boolean).map((file) => file.replace(/^evidence\//, ""));
  const seen = new Set();
  const referenceKeys = new Set([
    "file", "action_file", "capability_file", "decision_file", "execution_file", "interaction_file",
    "prepared_interaction_file", "artifact_file", "attempt_file", "authorization_file", "command_file",
    "downstream_impact_file", "impact_file", "plan_registration_file", "recovery_file", "review_decision_file",
    "review_file", "verification_file", "spec_registration_file", "stable_file", "simplification_file",
    "authority_file", "build_file", "handoff_file", "observation_file", "plan_file", "ship_file", "spec_file",
    "stop_file", "current_event_file", "event_file", "previous_event_file", "resume_decision_file", "resume_file",
    "stop_event_file", "approval_file", "approval_interaction_file", "metadata_file", "new_spec_artifact_file",
    "registration_file", "revision_file", "prior_plan_registration_file", "prior_spec_registration_file",
    "diagnosis_decision_file", "reproduction_file", "synthesis_decision_file", "validation_file", "baseline_file",
    "session_file", "acceptance_file", "risk_acceptance_file", "scope_file", "rejected_file", "rejection_file",
    "context_file", "repair_of", "simplification_of", "review_of",
  ]);
  const safeEvidenceFile = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*\.json$/;
  const enqueue = (value, field) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) return value.forEach((entry) => enqueue(entry, field));
    if (typeof value !== "string") throw new ControllerError("MDF_REVIEW_EVIDENCE_PATH_INVALID", "Lifecycle evidence reference must be a string or null.", { field, path: value });
    if (value.startsWith("evidence/")) {
      const relative = value.slice("evidence/".length);
      if (!safeEvidenceFile.test(relative)) throw new ControllerError("MDF_REVIEW_EVIDENCE_PATH_INVALID", "Lifecycle evidence reference is not a canonical evidence sidecar path.", { path: value });
      queue.push(relative);
      return;
    }
    if (!safeEvidenceFile.test(value)) throw new ControllerError("MDF_REVIEW_EVIDENCE_PATH_INVALID", "Lifecycle evidence reference is not a canonical evidence sidecar filename.", { field, path: value });
    queue.push(value);
  };
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!fs.existsSync(path.join(context.work_item.path, "evidence", file))) throw new ControllerError("MDF_REVIEW_INPUT_STALE", "Lifecycle evidence references a missing linked sidecar.", { file });
    const sidecar = verifySidecar(context, file, { fresh: false });
    paths.add(`evidence/${file}`);
    (sidecar.inputs || []).forEach((input) => {
      paths.add(input.path);
      if (input.path.startsWith("evidence/")) enqueue(input.path, "inputs");
    });
    const scan = (value, field = "reference") => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) return value.forEach((entry) => scan(entry, field));
      for (const [key, entry] of Object.entries(value)) {
        if (referenceKeys.has(key)) enqueue(entry, key);
        else if (entry && typeof entry === "object") scan(entry, key);
      }
    };
    scan(sidecar.invocation);
    scan(sidecar.conclusion);
    scan(sidecar.interaction);
  }
  return [...paths].sort();
}

function lifecycleInputs(context, { planFile, plan, spec, stableFile, simplifyFile, planEvent, wholeEvent, simplifyEvent }) {
  const roots = [planFile, plan.invocation.spec_registration_file, stableFile, simplifyFile, planEvent?.file, wholeEvent?.file, simplifyEvent?.file];
  return [artifactPath(context, spec.invocation.artifact_file), artifactPath(context, plan.invocation.artifact_file), ...collectSidecarGraph(context, roots)].sort();
}

function createTaskReviewContext(context, requestedFiles) {
  if (git(context, ["status", "--porcelain"])) throw new ControllerError("MDF_REVIEW_TREE_DIRTY", "Direct task review requires a clean worktree.");
  const marker = lifecycleEvidencePresent(context);
  if (marker.present) throw new ControllerError("MDF_REVIEW_LIFECYCLE_EVIDENCE_PRESENT", "Lifecycle evidence is present; direct task review cannot bypass the lifecycle path.", { invalid: marker.invalid });
  const files = verificationPaths(requestedFiles);
  const base = baseFacts(context);
  const head = git(context, ["rev-parse", "HEAD"]);
  const provenance = taskProvenance(context);
  const expected = { ...provenance, ...base, head };
  const verifications = files.map((file) => freshVerification(context, file, expected));
  const diff = diffSnapshot(context, base.base_commit, head);
  const inputs = ["item.md", diff.path, ...files].sort();
  const reviewContext = recordInteraction(context, {
    invocation: {
      agent_id: "mdf-review-context",
      invocation_id: `review-context-task-${head}`,
      executor: "deterministic-runtime",
      review_mode: "task-review",
      ...provenance,
      base_ref: base.base_ref,
      base_commit: base.base_commit,
      head,
      diff_path: diff.path,
      diff_sha256: diff.sha256,
      diff_bytes: diff.bytes,
      verification_files: files,
      verification_outputs: verifications.map(({ file, command_file, command, output }) => ({ file, command_file, command, output })),
    },
    input_paths: inputs,
  });
  return { context_file: reviewContext.file, input_paths: [...inputs, `evidence/${reviewContext.file}`].sort(), head, review_mode: "task-review" };
}

function createReviewContext(context, request = {}) {
  if (request.mode === "task-review") return createTaskReviewContext(context, request.verification_files);
  if (request.mode !== undefined && request.mode !== "lifecycle-review") throw new ControllerError("MDF_REVIEW_MODE_INVALID", "Review context mode must be lifecycle-review or task-review.", { mode: request.mode });
  return createLifecycleReviewContext(context);
}

const CALLER_PROVENANCE_FIELDS = ["review_mode", "task_id", "work_id", "task_card_sha256", "canonical_root", "worktree", "branch", "lock_path", "lock", "base_ref", "base_commit", "head", "diff_path", "diff_sha256", "diff_bytes", "verification_files", "verification_outputs"];

function assertNoCallerProvenance(request) {
  const field = CALLER_PROVENANCE_FIELDS.find((key) => request[key] !== undefined);
  if (field) throw new ControllerError("MDF_REVIEW_EVIDENCE_MISMATCH", "Review registration accepts only the resolved context and execution mode; provenance is context-owned.", { field });
}

function verifyReviewContextFresh(context, file) {
  try {
    return verifySidecar(context, file);
  } catch (error) {
    if (["MDF_EVIDENCE_STALE", "MDF_EVIDENCE_PATH_MISSING"].includes(error.code)) throw new ControllerError("MDF_REVIEW_INPUT_STALE", "Review context inputs changed or disappeared before registration.", { file, cause: error.message });
    throw error;
  }
}

function registerReview(context, request) {
  const { context_file: contextFile, output_path: outputPath, decision_file: decisionFile, mode } = request;
  assertNoCallerProvenance(request);
  if (!new Set(["standalone", "auto"]).has(mode)) throw new ControllerError("MDF_REVIEW_MODE_INVALID", "Review execution mode must be standalone or auto.");
  const reviewContext = verifyReviewContextFresh(context, contextFile);
  const reviewMode = reviewContext.invocation?.review_mode;
  if (!new Set(["lifecycle-review", "task-review"]).has(reviewMode)) throw new ControllerError("MDF_REVIEW_MODE_INVALID", "Review context must carry an explicit resolver-owned review mode.");
  if (reviewContext.invocation?.agent_id !== "mdf-review-context" || (mode === "auto" && (current(context).phase !== "review" || reviewMode !== "lifecycle-review")) || (mode === "standalone" && !new Set(["lifecycle-review", "task-review"]).has(reviewMode))) throw new ControllerError("MDF_REVIEW_CONTEXT_INVALID", "Review decision requires a current context with a compatible review mode.");
  refreshTaskProvenance(context, reviewContext.invocation);
  if (reviewMode === "task-review" && mode !== "standalone") throw new ControllerError("MDF_REVIEW_MODE_INVALID", "Direct task-review provenance accepts standalone registration only.");
  if (reviewMode === "task-review") revalidateDirectReview(context, reviewContext);
  verifyInputs(context, reviewContext);
  const expected = [...reviewContext.inputs.map((input) => input.path), `evidence/${contextFile}`].sort();
  const { decision, action } = verifyAdapterDecision(context, decisionFile, { action: "standalone-review", skill_path: "skills/code-review-and-quality/SKILL.md", persona_path: "agents/code-reviewer.md", output_path: outputPath });
  if (!new Set(["pass", "findings"]).has(decision.conclusion?.disposition) || (decision.conclusion.disposition === "findings" && typeof decision.conclusion.human_required !== "boolean") || JSON.stringify(action.inputs.map((input) => input.path).sort()) !== JSON.stringify(expected)) throw new ControllerError("MDF_REVIEW_DECISION_INVALID", "Review decision must bind exact current context and raw report.");
  const semantic = decision.conclusion;
  const interaction = recordInteraction(context, { invocation: { agent_id: "mdf-standalone-review", invocation_id: `review-${reviewContext.invocation.head}-${Date.now()}`, executor: "deterministic-runtime", mode, review_mode: reviewMode, context_file: contextFile, decision_file: decisionFile, disposition: semantic.disposition, task_id: reviewContext.invocation.task_id, work_id: reviewContext.invocation.work_id, head: reviewContext.invocation.head }, input_paths: [...expected, outputPath, `evidence/${decisionFile}`] });
  const result = recordDecision(context, { interaction_file: interaction.file, conclusion: { kind: "standalone-review", mode, review_mode: reviewMode, context_file: contextFile, plan_registration_file: reviewContext.invocation.plan_registration_file || null, task_id: reviewContext.invocation.task_id, work_id: reviewContext.invocation.work_id, head: reviewContext.invocation.head, disposition: semantic.disposition, human_required: semantic.human_required === true, affected_task_id: semantic.affected_task_id || null, repair_scope_paths: semantic.repair_scope_paths || [] } });
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
