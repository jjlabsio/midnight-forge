const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { resolveControllerContext } = require("./controller-runtime/context");
const { recordDecision, recordInteraction } = require("./controller-runtime/evidence");
const { createShipContext, recordRiskAcceptance, registerShip } = require("./controller-runtime/ship");
const { EDGES, assertLifecycleReviewEvidence, recordEvent } = require("./controller-runtime/lifecycle");

const root = path.resolve(__dirname, "..");

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}

function fixture() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-review-consumers-"));
  const canonicalRoot = path.join(temporaryRoot, "project");
  const worktreePath = path.join(canonicalRoot, ".worktrees", "consumer");
  fs.mkdirSync(canonicalRoot, { recursive: true });
  git(canonicalRoot, ["init", "--quiet"]);
  git(canonicalRoot, ["config", "user.email", "test@example.com"]);
  git(canonicalRoot, ["config", "user.name", "MDF test"]);
  write(path.join(canonicalRoot, "tracked.txt"), "fixture\n");
  git(canonicalRoot, ["add", "tracked.txt"]);
  git(canonicalRoot, ["commit", "--quiet", "-m", "fixture"]);
  git(canonicalRoot, ["branch", "-m", "main"]);
  fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
  git(canonicalRoot, ["worktree", "add", "--quiet", "-b", "codex/consumer", worktreePath, "HEAD"]);
  const worktree = fs.realpathSync(worktreePath);
  const canonical = fs.realpathSync(canonicalRoot);
  const workId = "2026-07-13-review-consumers";
  const itemPath = path.join(canonical, ".mdf", "work", workId, "item.md");
  write(path.join(canonical, ".mdf", "project", "init.json"), "{\"version\":1}\n");
  write(itemPath, `---\nkind: task\nwork_id: "${workId}"\ntask_id: "0036"\ntitle: "Consumer fixture"\norder: 36\nstatus: active\ncreated: "2026-07-13"\nlatest: {}\nworktree: "${worktree}"\nbranch: "codex/consumer"\n---\n`);
  write(path.join(canonical, ".mdf", "locks", "0036.lock"), JSON.stringify({ task_id: "0036", work_id: workId, canonical_root: canonical, worktree, branch: "codex/consumer", started: "2026-07-13T00:00:00.000Z", runtime: "test" }, null, 2));
  const head = git(worktree, ["rev-parse", "HEAD"]);
  git(worktree, ["update-ref", "refs/remotes/origin/main", head]);
  git(worktree, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);
  return { temporaryRoot, context: resolveControllerContext({ cwd: worktree, pluginRoot: root }) };
}

function expectCode(callback, code) {
  assert.throws(callback, (error) => error && error.code === code, `expected ${code}`);
}

function reviewEvidence(context, { reviewMode = "task-review", agentId = "mdf-standalone-review", conclusionMode = reviewMode, kind = "standalone-review" } = {}) {
  const interaction = recordInteraction(context, { invocation: { agent_id: agentId, invocation_id: `review-${Date.now()}-${Math.random()}`, executor: "deterministic-runtime", review_mode: reviewMode }, input_paths: [] });
  const decision = recordDecision(context, { interaction_file: interaction.file, conclusion: { kind, disposition: "pass", review_mode: conclusionMode } });
  return { interaction, decision };
}

function lifecycleDirectTests() {
  const flow = fixture();
  try {
    const direct = reviewEvidence(flow.context);
    expectCode(() => recordEvent(flow.context, { event_id: "reject-direct", from: "spec", to: "plan", evidence_files: [direct.decision.file] }), "MDF_LIFECYCLE_REVIEW_MODE_INVALID");
    const relabeled = reviewEvidence(flow.context, { conclusionMode: "lifecycle-review" });
    expectCode(() => recordEvent(flow.context, { event_id: "reject-relabel", from: "spec", to: "plan", evidence_files: [relabeled.decision.file] }), "MDF_LIFECYCLE_REVIEW_MODE_INVALID");
    const missingModeInteraction = recordInteraction(flow.context, { invocation: { agent_id: "mdf-standalone-review", invocation_id: "missing-mode", executor: "deterministic-runtime" }, input_paths: [] });
    const missingModeDecision = recordDecision(flow.context, { interaction_file: missingModeInteraction.file, conclusion: { kind: "standalone-review", disposition: "pass", task_id: "0036" } });
    expectCode(() => recordEvent(flow.context, { event_id: "reject-missing-mode", from: "spec", to: "plan", evidence_files: [missingModeDecision.file] }), "MDF_LIFECYCLE_REVIEW_MODE_INVALID");
    const foreign = reviewEvidence(flow.context, { agentId: "caller-authored", reviewMode: "lifecycle-review", conclusionMode: "lifecycle-review" });
    expectCode(() => recordEvent(flow.context, { event_id: "reject-foreign", from: "spec", to: "plan", evidence_files: [foreign.decision.file] }), "MDF_LIFECYCLE_REVIEW_MODE_INVALID");
    write(path.join(flow.context.work_item.path, "review-source.md"), "before\n");
    const stale = recordInteraction(flow.context, { invocation: { agent_id: "mdf-standalone-review", invocation_id: "stale", executor: "deterministic-runtime", review_mode: "lifecycle-review" }, input_paths: ["review-source.md"] });
    const staleDecision = recordDecision(flow.context, { interaction_file: stale.file, conclusion: { kind: "standalone-review", disposition: "pass", review_mode: "lifecycle-review" } });
    write(path.join(flow.context.work_item.path, "review-source.md"), "after\n");
    expectCode(() => recordEvent(flow.context, { event_id: "reject-stale", from: "spec", to: "plan", evidence_files: [staleDecision.file] }), "MDF_EVIDENCE_STALE");
    for (const [from, tos] of EDGES) for (const to of tos) expectCode(() => assertLifecycleReviewEvidence(flow.context, relabeled.decision.file), "MDF_LIFECYCLE_REVIEW_MODE_INVALID");
    const lifecycle = reviewEvidence(flow.context, { reviewMode: "lifecycle-review" });
    assert.strictEqual(recordEvent(flow.context, { event_id: "accept-lifecycle", from: "spec", to: "plan", evidence_files: [lifecycle.decision.file] }).state.phase, "plan");
    const malformed = recordInteraction(flow.context, { invocation: { agent_id: "mdf-standalone-review", invocation_id: "malformed", executor: "deterministic-runtime", review_mode: "lifecycle-review" }, input_paths: [] });
    const malformedValue = JSON.parse(fs.readFileSync(path.join(flow.context.work_item.path, "evidence", malformed.file), "utf8"));
    malformedValue.inputs = [{}];
    delete malformedValue.integrity_sha256;
    malformedValue.integrity_sha256 = require("crypto").createHash("sha256").update(JSON.stringify(malformedValue)).digest("hex");
    write(path.join(flow.context.work_item.path, "evidence", malformed.file), `${JSON.stringify(malformedValue, null, 2)}\n`);
    expectCode(() => recordEvent(flow.context, { event_id: "reject-malformed", from: "plan", to: "build-task", evidence_files: [malformed.file] }), "MDF_LIFECYCLE_MALFORMED");
  } finally {
    fs.rmSync(flow.temporaryRoot, { recursive: true, force: true });
  }
}

function lifecycleEdgeMatrix() {
  const order = ["spec", "plan", "build-task", "whole-build", "simplify", "review", "ship", "github-pr"];
  for (const [from, tos] of EDGES) for (const to of tos) {
    const flow = fixture();
    try {
      const { context } = flow;
      const plan = recordInteraction(context, { invocation: { agent_id: "mdf-plan", invocation_id: `matrix-plan-${from}-${to}`, executor: "deterministic-runtime" }, input_paths: [] });
      const seed = recordInteraction(context, { invocation: { agent_id: "seed", invocation_id: `matrix-seed-${from}-${to}`, executor: "deterministic-runtime" }, input_paths: [] });
      let previous = null;
      const targetIndex = order.indexOf(from);
      for (let index = 1; index <= targetIndex; index += 1) {
        const evidence = order[index - 1] === "plan" && order[index] === "build-task" ? [plan.file] : [seed.file];
        const event = recordInteraction(context, { invocation: { agent_id: "mdf-lifecycle", invocation_id: `matrix-${order[index - 1]}-${order[index]}-${from}-${to}`, executor: "deterministic-runtime", previous_event_file: previous, from: order[index - 1], to: order[index] }, input_paths: evidence.map((file) => `evidence/${file}`) });
        previous = event.file;
      }
      const direct = reviewEvidence(context);
      const relabeled = reviewEvidence(context, { conclusionMode: "lifecycle-review" });
      const foreign = reviewEvidence(context, { agentId: "caller-authored", reviewMode: "lifecycle-review", conclusionMode: "lifecycle-review" });
      const missingInteraction = recordInteraction(context, { invocation: { agent_id: "mdf-standalone-review", invocation_id: `matrix-missing-${from}-${to}`, executor: "deterministic-runtime" }, input_paths: [] });
      const missingMode = recordDecision(context, { interaction_file: missingInteraction.file, conclusion: { kind: "standalone-review", disposition: "pass", task_id: "0036" } });
      write(path.join(context.work_item.path, "matrix-stale.md"), "before\n");
      const staleInteraction = recordInteraction(context, { invocation: { agent_id: "mdf-standalone-review", invocation_id: `matrix-stale-${from}-${to}`, executor: "deterministic-runtime", review_mode: "lifecycle-review" }, input_paths: ["matrix-stale.md"] });
      const stale = recordDecision(context, { interaction_file: staleInteraction.file, conclusion: { kind: "standalone-review", disposition: "pass", review_mode: "lifecycle-review" } });
      write(path.join(context.work_item.path, "matrix-stale.md"), "after\n");
      const malformedInteraction = recordInteraction(context, { invocation: { agent_id: "mdf-standalone-review", invocation_id: `matrix-malformed-${from}-${to}`, executor: "deterministic-runtime", review_mode: "lifecycle-review" }, input_paths: [] });
      const valid = reviewEvidence(context, { reviewMode: "lifecycle-review" });
      const reject = (file, code, label) => expectCode(() => recordEvent(context, { event_id: `matrix-${label}-${from}-${to}`, from, to, evidence_files: [file] }), code);
      reject(direct.decision.file, "MDF_LIFECYCLE_REVIEW_MODE_INVALID", "direct");
      reject(relabeled.decision.file, "MDF_LIFECYCLE_REVIEW_MODE_INVALID", "relabel");
      reject(foreign.decision.file, "MDF_LIFECYCLE_REVIEW_MODE_INVALID", "foreign");
      reject(missingMode.file, "MDF_LIFECYCLE_REVIEW_MODE_INVALID", "missing");
      reject(stale.file, "MDF_EVIDENCE_STALE", "stale");
      assert.strictEqual(recordEvent(context, { event_id: `matrix-valid-${from}-${to}`, from, to, evidence_files: [valid.decision.file] }).state.phase, to);
      const malformedPath = path.join(context.work_item.path, "evidence", malformedInteraction.file);
      const malformed = JSON.parse(fs.readFileSync(malformedPath, "utf8"));
      malformed.inputs = [{}];
      delete malformed.integrity_sha256;
      malformed.integrity_sha256 = require("crypto").createHash("sha256").update(JSON.stringify(malformed)).digest("hex");
      write(malformedPath, `${JSON.stringify(malformed, null, 2)}\n`);
      expectCode(() => assertLifecycleReviewEvidence(context, malformedInteraction.file), "MDF_EVIDENCE_FABRICATED");
    } finally {
      fs.rmSync(flow.temporaryRoot, { recursive: true, force: true });
    }
  }
}

function shipDirectTest() {
  const flow = fixture();
  try {
    const { context } = flow;
    const plan = recordInteraction(context, { invocation: { agent_id: "mdf-plan", invocation_id: "plan", executor: "deterministic-runtime" }, input_paths: [] });
    const direct = reviewEvidence(context);
    const seed = recordInteraction(context, { invocation: { agent_id: "seed", invocation_id: "seed", executor: "deterministic-runtime" }, input_paths: [] });
    const event = (id, previous, from, to, evidence) => recordInteraction(context, { invocation: { agent_id: "mdf-lifecycle", invocation_id: id, executor: "deterministic-runtime", previous_event_file: previous, from, to }, input_paths: evidence.map((file) => `evidence/${file}`) });
    const specPlan = event("spec-plan", null, "spec", "plan", [plan.file]);
    const planBuild = event("plan-build", specPlan.file, "plan", "build-task", [plan.file]);
    const buildWhole = event("build-whole", planBuild.file, "build-task", "whole-build", [seed.file]);
    const wholeSimplify = event("whole-simplify", buildWhole.file, "whole-build", "simplify", [seed.file]);
    const simplifyReview = event("simplify-review", wholeSimplify.file, "simplify", "review", [seed.file]);
    event("review-ship", simplifyReview.file, "review", "ship", [direct.decision.file]);
    const shipContext = recordInteraction(context, { invocation: { agent_id: "mdf-ship-context", invocation_id: "ship-context", executor: "deterministic-runtime", review_file: direct.decision.file, head: git(context.worktree, ["rev-parse", "HEAD"]) }, input_paths: [`evidence/${direct.decision.file}`] });
    expectCode(() => recordRiskAcceptance(context, { context_file: shipContext.file, user_message_path: "missing.md", report_decision_files: [], risk_ids: [], affirmative: true }), "MDF_LIFECYCLE_REVIEW_MODE_INVALID");
    expectCode(() => registerShip(context, { context_file: shipContext.file, reports: [], output_path: "ship.md", decision_file: "missing.json" }), "MDF_LIFECYCLE_REVIEW_MODE_INVALID");
    expectCode(() => createShipContext(context), "MDF_LIFECYCLE_REVIEW_MODE_INVALID");
  } finally {
    fs.rmSync(flow.temporaryRoot, { recursive: true, force: true });
  }
}

try {
  lifecycleDirectTests();
  lifecycleEdgeMatrix();
  shipDirectTest();
  console.log("MDF review consumer validation passed");
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
