const path = require("path");

const INTERVIEW_REASONS = Object.freeze([
  "missing-intent-field",
  "materially-different-interpretations",
  "unsurfaced-assumption",
  "conflicting-optimization-goals",
  "confidence-below-95",
  "explicit-interview-request"
]);

function interviewGate(input = {}) {
  const reasons = [];
  const missingFields = Array.isArray(input.missingFields) ? input.missingFields : [];
  if (missingFields.length > 0) reasons.push("missing-intent-field");
  if (input.materiallyDifferentInterpretations === true) reasons.push("materially-different-interpretations");
  if (input.unsurfacedAssumption === true) reasons.push("unsurfaced-assumption");
  if (input.conflictingOptimizationGoals === true) reasons.push("conflicting-optimization-goals");
  if (typeof input.confidence === "number" && input.confidence < 95) reasons.push("confidence-below-95");
  if (input.explicitInterviewRequest === true) reasons.push("explicit-interview-request");

  const speedException = input.speedOverVerification === true && reasons.length === 0;
  return {
    required: reasons.length > 0,
    speedException,
    reasons: [...new Set(reasons)],
    missingFields: [...missingFields]
  };
}

function autoHandoffGate(context = {}) {
  const reasons = [];
  const phases = new Set(["intent", "spec", "plan", "build", "test", "review", "simplify", "ship", "pr"]);
  const forbiddenActions = new Set(["merge", "deploy", "delete", "force", "stale-lock-takeover"]);
  if (context.mode !== "auto-workflow") reasons.push("missing-auto-mode");
  if (context.rootIssued !== true) reasons.push("handoff-not-root-issued");
  if (typeof context.run_id !== "string" || context.run_id.length === 0) reasons.push("missing-run-id");
  if (typeof context.intent_digest !== "string" || context.intent_digest.length === 0) reasons.push("missing-intent-digest");
  if (typeof context.handoffRecord?.path !== "string" || !context.handoffRecord.path.startsWith(".mdf/")) reasons.push("invalid-handoff-record-path");
  if (typeof context.handoffRecord?.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(context.handoffRecord.sha256)) reasons.push("invalid-handoff-record-sha256");
  if (typeof context.current_phase !== "string" || !phases.has(context.current_phase)) reasons.push("invalid-current-phase");
  if (!Array.isArray(context.allowed_mdf_skills) || context.allowed_mdf_skills.length === 0) reasons.push("missing-allowed-skills");
  if (!Array.isArray(context.allowed_external_actions)) reasons.push("missing-allowed-actions");
  if (context.allowed_external_actions?.some((action) => forbiddenActions.has(action))) reasons.push("forbidden-external-action");
  if (["plan", "build", "test", "review", "simplify", "ship", "pr"].includes(context.current_phase) && (typeof context.spec_path !== "string" || typeof context.spec_sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(context.spec_sha256))) reasons.push("missing-spec-handoff");
  if (["build", "test", "review", "simplify", "ship", "pr"].includes(context.current_phase) && (typeof context.plan_path !== "string" || typeof context.plan_sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(context.plan_sha256))) reasons.push("missing-plan-handoff");
  return { valid: reasons.length === 0, reasons: [...new Set(reasons)] };
}

function normalizeOwnedPath(raw) {
  if (typeof raw !== "string" || raw.length === 0 || path.isAbsolute(raw)) return null;
  const normalized = path.posix.normalize(raw.replaceAll("\\", "/")).replace(/^\.\//, "");
  if (normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) return null;
  return normalized;
}

function pathsOverlap(left, right) {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function parallelWriterEligibility(input = {}) {
  const reasons = [];
  const tasks = Array.isArray(input.tasks) ? input.tasks : [];
  const group = Array.isArray(input.parallelGroup) ? input.parallelGroup : [];
  const byId = new Map(tasks.map((task) => [task.id, task]));

  if (group.length < 2) reasons.push("parallel-group-too-small");
  if (new Set(group).size !== group.length) reasons.push("duplicate-task-id");
  if (group.some((id) => !byId.has(id))) reasons.push("unknown-task-id");
  if (!input.baseRevision) reasons.push("missing-base-revision");
  if (input.independenceReview?.status !== "pass" || !Array.isArray(input.independenceReview?.evidence) || input.independenceReview.evidence.length === 0) {
    reasons.push("missing-independence-evidence");
  }

  const normalized = [];
  for (const id of group) {
    const task = byId.get(id);
    if (!task) continue;
    if (!Array.isArray(task.dependsOn)) reasons.push(`missing-dependencies:${id}`);
    if (task.dependsOn?.some((dependency) => group.includes(dependency))) reasons.push(`parallel-dependency:${id}`);
    if (!Array.isArray(task.ownedPaths) || task.ownedPaths.length === 0) reasons.push(`missing-owned-paths:${id}`);
    for (const rawPath of task.ownedPaths || []) {
      const normalizedPath = normalizeOwnedPath(rawPath);
      if (!normalizedPath) reasons.push(`invalid-owned-path:${id}:${rawPath}`);
      else normalized.push({ id, path: normalizedPath });
    }
    for (const field of ["sharedContract", "sharedGeneratedOutput", "sharedLockfile", "sharedMigration", "sharedGlobalConfig", "sharedFixture", "sharedExternalResource", "sharedMdfState"]) {
      if (task[field] === true) reasons.push(`${field}:${id}`);
    }
    if (task.worktree?.isolated !== true) reasons.push(`worktree-not-isolated:${id}`);
    if (task.worktree?.clean !== true) reasons.push(`worktree-not-clean:${id}`);
    if (!task.worktree?.path || !task.worktree?.branch || !task.worktree?.baseRevision) reasons.push(`incomplete-worktree:${id}`);
    if (!task.lock?.owned || !task.lock?.path) reasons.push(`missing-lock:${id}`);
    if (task.worktree?.baseRevision && task.worktree.baseRevision !== input.baseRevision) reasons.push(`base-revision-mismatch:${id}`);
  }

  for (let left = 0; left < normalized.length; left += 1) {
    for (let right = left + 1; right < normalized.length; right += 1) {
      if (pathsOverlap(normalized[left].path, normalized[right].path)) {
        reasons.push(`owned-path-overlap:${normalized[left].id}:${normalized[right].id}`);
      }
    }
  }

  const worktrees = group.map((id) => byId.get(id)?.worktree).filter(Boolean);
  const branches = worktrees.map((worktree) => worktree.branch).filter(Boolean);
  const paths = worktrees.map((worktree) => worktree.path).filter(Boolean);
  const locks = group.map((id) => byId.get(id)?.lock?.path).filter(Boolean);
  if (new Set(branches).size !== branches.length) reasons.push("duplicate-branch");
  if (new Set(paths).size !== paths.length) reasons.push("duplicate-worktree");
  if (new Set(locks).size !== locks.length) reasons.push("duplicate-lock");

  return { eligible: reasons.length === 0, reasons: [...new Set(reasons)] };
}

function selectExplorationDispatch(capabilities = []) {
  const isReadOnlyReporter = (candidate) => (
    candidate.readOnly === true &&
    candidate.authority === "report-only" &&
    (candidate.writeScope ?? candidate.write_scope) === "none"
  );
  const preferred = capabilities.find((candidate) => (
    candidate.model === "gpt-5.3-codex-spark" &&
    candidate.verified === true &&
    candidate.transportCompatible === true &&
    isReadOnlyReporter(candidate)
  ));
  if (preferred) return { ...preferred, fallback: false, degraded: false };

  const fallback = capabilities.find((candidate) => (
    candidate.family === "gpt-5.6" &&
    candidate.verified === true &&
    candidate.transportCompatible === true &&
    isReadOnlyReporter(candidate)
  ));
  if (fallback) return { ...fallback, fallback: "gpt-5.3-codex-spark-unavailable", degraded: false };
  return { fallback: "root", degraded: true };
}

module.exports = {
  INTERVIEW_REASONS,
  interviewGate,
  autoHandoffGate,
  normalizeOwnedPath,
  pathsOverlap,
  parallelWriterEligibility,
  selectExplorationDispatch
};
