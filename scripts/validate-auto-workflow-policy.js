const assert = require("assert");
const {
  interviewGate,
  autoHandoffGate,
  normalizeOwnedPath,
  pathsOverlap,
  parallelWriterEligibility,
  selectExplorationDispatch
} = require("./auto-workflow-policy");

assert.strictEqual(interviewGate({ confidence: 94 }).required, true);
assert.deepStrictEqual(interviewGate({ missingFields: ["success"] }).reasons, ["missing-intent-field"]);
assert.strictEqual(interviewGate({ selfContained: true, confidence: 100 }).required, false);
assert.strictEqual(interviewGate({ selfContained: true, speedOverVerification: true }).speedException, true);
assert.strictEqual(interviewGate({ speedOverVerification: true, unsurfacedAssumption: true }).required, true);
assert.strictEqual(autoHandoffGate({ mode: "auto-workflow" }).valid, false);
assert.strictEqual(autoHandoffGate({
  mode: "auto-workflow",
  rootIssued: true,
  run_id: "run-1",
  intent_digest: "intent-1",
  handoffRecord: { path: ".mdf/work/run/handoff-001.md", sha256: "a".repeat(64) },
  current_phase: "intent",
  allowed_mdf_skills: ["spec"],
  allowed_external_actions: []
}).valid, true);
assert.strictEqual(autoHandoffGate({
  mode: "auto-workflow",
  rootIssued: true,
  run_id: "run-1",
  intent_digest: "intent-1",
  handoffRecord: { path: ".mdf/work/run/handoff-001.md", sha256: "a".repeat(64) },
  current_phase: "intent",
  allowed_mdf_skills: ["spec"],
  allowed_external_actions: ["merge"]
}).valid, false);
assert.strictEqual(normalizeOwnedPath("src\\feature\\file.js"), "src/feature/file.js");
assert.strictEqual(normalizeOwnedPath("../escape.js"), null);
assert.strictEqual(pathsOverlap("src/a", "src/a/test.js"), true);
assert.strictEqual(pathsOverlap("src/a", "src/b"), false);

const base = {
  baseRevision: "abc123",
  independenceReview: { status: "pass", evidence: ["no shared contract"] },
  parallelGroup: ["a", "b"],
  tasks: [
    {
      id: "a",
      dependsOn: [],
      ownedPaths: ["src/a.js"],
      worktree: { isolated: true, clean: true, path: ".worktrees/a", branch: "task-a", baseRevision: "abc123" },
      lock: { owned: true, path: ".mdf/locks/a.lock" }
    },
    {
      id: "b",
      dependsOn: [],
      ownedPaths: ["src/b.js"],
      worktree: { isolated: true, clean: true, path: ".worktrees/b", branch: "task-b", baseRevision: "abc123" },
      lock: { owned: true, path: ".mdf/locks/b.lock" }
    }
  ]
};
assert.strictEqual(parallelWriterEligibility(base).eligible, true);
assert.strictEqual(parallelWriterEligibility({ ...base, tasks: [{ ...base.tasks[0], ownedPaths: ["src/shared"] }, { ...base.tasks[1], ownedPaths: ["src/shared/test.js"] }] }).eligible, false);
assert.strictEqual(parallelWriterEligibility({ ...base, tasks: [{ ...base.tasks[0], sharedContract: true }, base.tasks[1]] }).eligible, false);
assert.strictEqual(parallelWriterEligibility({ ...base, tasks: [{ ...base.tasks[0], dependsOn: ["b"] }, base.tasks[1]] }).eligible, false);
assert.strictEqual(parallelWriterEligibility({ ...base, tasks: [{ ...base.tasks[0], ownedPaths: [] }, base.tasks[1]] }).eligible, false);
assert.strictEqual(parallelWriterEligibility({ ...base, tasks: [{ ...base.tasks[0], worktree: { ...base.tasks[0].worktree, clean: false } }, base.tasks[1]] }).eligible, false);
assert.strictEqual(parallelWriterEligibility({ ...base, tasks: [{ ...base.tasks[0], lock: { owned: true, path: ".mdf/locks/shared.lock" } }, { ...base.tasks[1], lock: { owned: true, path: ".mdf/locks/shared.lock" } }] }).eligible, false);
assert.strictEqual(parallelWriterEligibility({ ...base, tasks: [{ ...base.tasks[0], sharedFixture: true }, base.tasks[1]] }).eligible, false);

const spark = selectExplorationDispatch([
  { model: "gpt-5.3-codex-spark", verified: true, transportCompatible: true, readOnly: true, authority: "report-only", writeScope: "none" }
]);
assert.strictEqual(spark.model, "gpt-5.3-codex-spark");
assert.strictEqual(selectExplorationDispatch([
  { model: "gpt-5.3-codex-spark", verified: true, transportCompatible: true, readOnly: true }
]).degraded, true);
const fallback = selectExplorationDispatch([
  { model: "gpt-5.3-codex-spark", verified: true, transportCompatible: false, readOnly: true },
  { family: "gpt-5.6", variant: "luna", verified: true, transportCompatible: true, readOnly: true, authority: "report-only", writeScope: "none" }
]);
assert.strictEqual(fallback.fallback, "gpt-5.3-codex-spark-unavailable");
assert.strictEqual(selectExplorationDispatch([]).degraded, true);

console.log("Auto-workflow policy validation passed.");
