const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { resolveReviewControllerContext } = require("./controller-runtime/context");
const { createReviewContext, registerReview } = require("./controller-runtime/review");
const { recordCommand, recordInteraction, recordVerification, verifySidecar } = require("./controller-runtime/evidence");
const { issueAction, issueCapability, prepareAdapter, submitOutcome } = require("./controller-runtime/adapter");
const { runVerification } = require("./controller-runtime/build-task");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "scripts", "mdf-controller.js");

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function write(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
}

function fixture() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-review-registration-"));
  const canonicalRoot = path.join(temporaryRoot, "project");
  const requestedWorktree = path.join(canonicalRoot, ".worktrees", "review-direct");
  fs.mkdirSync(canonicalRoot, { recursive: true });
  git(canonicalRoot, ["init", "--quiet"]);
  git(canonicalRoot, ["config", "user.email", "test@example.com"]);
  git(canonicalRoot, ["config", "user.name", "MDF test"]);
  write(path.join(canonicalRoot, "tracked.txt"), "fixture\n");
  git(canonicalRoot, ["add", "tracked.txt"]);
  git(canonicalRoot, ["commit", "--quiet", "-m", "fixture"]);
  git(canonicalRoot, ["branch", "-m", "main"]);
  fs.mkdirSync(path.dirname(requestedWorktree), { recursive: true });
  git(canonicalRoot, ["worktree", "add", "--quiet", "-b", "codex/review-direct", requestedWorktree, "HEAD"]);
  const worktree = fs.realpathSync(requestedWorktree);
  const head = git(worktree, ["rev-parse", "HEAD"]);
  git(worktree, ["update-ref", "refs/remotes/origin/main", head]);
  git(worktree, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);
  const workId = "2026-07-13-0036-review";
  const requestedWorkItem = path.join(canonicalRoot, ".mdf", "work", workId);
  write(path.join(canonicalRoot, ".mdf", "project", "init.json"), "{\"version\":1}\n");
  fs.mkdirSync(requestedWorkItem, { recursive: true });
  const workItem = fs.realpathSync(requestedWorkItem);
  fs.mkdirSync(path.join(workItem, "evidence"), { recursive: true });
  write(path.join(workItem, "item.md"), `---\nkind: task\nwork_id: "${workId}"\ntask_id: "0036"\ntitle: "Review"\norder: 36\nstatus: done\ncreated: "2026-07-13"\ncompleted: "2026-07-13"\nworktree: "${worktree}"\nbranch: "codex/review-direct"\n---\n`);
  return {
    temporaryRoot,
    context: {
      canonical_root: fs.realpathSync(canonicalRoot),
      worktree,
      lock: null,
      task: { task_id: "0036", work_id: workId, card_sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(workItem, "item.md"))).digest("hex"), branch: "codex/review-direct", worktree },
      work_item: { id: workId, path: workItem, item_path: path.join(workItem, "item.md") },
      plugin_root: root,
    },
  };
}

function verification(context, producer = "mdf-direct-verification") {
  write(path.join(context.work_item.path, "verify.log"), "ok\n");
  const command = recordCommand(context, { command: [process.execPath, "-e", "process.exit(0)"], output_path: "verify.log", exit_code: 0 });
  return recordVerification(context, {
    invocation: {
      agent_id: producer,
      invocation_id: `verification-${producer}`,
      executor: "deterministic-runtime",
      command_file: command.file,
      exit_code: 0,
      task_id: context.task.task_id,
      work_id: context.task.work_id,
      canonical_root: context.canonical_root,
      worktree: context.worktree,
      branch: context.task.branch,
      base_commit: git(context.worktree, ["rev-parse", "HEAD"]),
      head: git(context.worktree, ["rev-parse", "HEAD"]),
    },
    input_paths: ["verify.log", `evidence/${command.file}`],
  });
}

function expectCode(callback, code) {
  assert.throws(callback, (error) => error && error.code === code, `expected ${code}`);
}

function reviewDecision(context, reviewContext, outcome) {
  write(path.join(context.work_item.path, "report.md"), "pass\n");
  write(path.join(context.work_item.path, "capability.json"), "{}\n");
  const action = issueAction(context, {
    action_id: `review-${Date.now()}`,
    action: "standalone-review",
    skill_path: "skills/code-review-and-quality/SKILL.md",
    persona_path: "agents/code-reviewer.md",
    input_paths: reviewContext.input_paths,
  });
  const invocation = {
    agent_id: "reviewer",
    invocation_id: `reviewer-${Date.now()}`,
    executor: "subagent",
    model_capability: "independent-review-capable",
    freshness: "fresh",
    capability: { persona_loaded: true, fresh_context: true, reasoning_capable: true, model_suitable: true, source: "runtime-verified" },
  };
  const capability = issueCapability(context, { ...invocation, persona_path: "agents/code-reviewer.md", evidence_path: "capability.json" });
  const prepared = prepareAdapter(context, { action_file: action.action_file, capability_file: capability.capability_file, invocation });
  return submitOutcome(context, { action_id: action.action_id, interaction_file: prepared.interaction_file, output_path: "report.md", outcome });
}

function resolverFixture({ active = false } = {}) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-review-dispatcher-"));
  const canonicalRoot = path.join(temporaryRoot, "project");
  const worktree = path.join(canonicalRoot, ".worktrees", "review-direct");
  fs.mkdirSync(canonicalRoot, { recursive: true });
  git(canonicalRoot, ["init", "--quiet"]);
  git(canonicalRoot, ["config", "user.email", "test@example.com"]);
  git(canonicalRoot, ["config", "user.name", "MDF test"]);
  write(path.join(canonicalRoot, "tracked.txt"), "fixture\n");
  git(canonicalRoot, ["add", "tracked.txt"]);
  git(canonicalRoot, ["commit", "--quiet", "-m", "fixture"]);
  git(canonicalRoot, ["branch", "-m", "main"]);
  fs.mkdirSync(path.dirname(worktree), { recursive: true });
  git(canonicalRoot, ["worktree", "add", "--quiet", "-b", "codex/review-direct", worktree, "HEAD"]);
  const canonicalWorktree = fs.realpathSync(worktree);
  const workId = "2026-07-13-0036-dispatcher";
  const workItem = path.join(canonicalRoot, ".mdf", "work", workId);
  write(path.join(canonicalRoot, ".mdf", "project", "init.json"), "{\"version\":1}\n");
  write(path.join(workItem, "item.md"), `---\nkind: task\nwork_id: "${workId}"\ntask_id: "0036"\ntitle: "Direct review dispatcher"\norder: 36\nstatus: ${active ? "active" : "done"}\ncreated: "2026-07-13"\n${active ? "" : "completed: \"2026-07-13\"\n"}worktree: "${canonicalWorktree}"\nbranch: "codex/review-direct"\n---\n`);
  write(path.join(workItem, "evidence", ".keep"), "\n");
  const lockPath = path.join(canonicalRoot, ".mdf", "locks", "0036.lock");
  if (active) write(lockPath, JSON.stringify({ task_id: "0036", work_id: workId, canonical_root: fs.realpathSync(canonicalRoot), worktree: canonicalWorktree, branch: "codex/review-direct", started: "2026-07-13T00:00:00.000Z", runtime: "test" }, null, 2));
  git(canonicalRoot, ["update-ref", "refs/remotes/origin/main", git(canonicalRoot, ["rev-parse", "HEAD"])]);
  git(canonicalRoot, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);
  const context = resolveReviewControllerContext({ cwd: canonicalWorktree, pluginRoot: root });
  return { temporaryRoot, canonicalRoot, worktree: canonicalWorktree, lockPath, context };
}

function runTests() {
  const direct = fixture();
  try {
    const produced = verification(direct.context);
    const result = createReviewContext(direct.context, { mode: "task-review", verification_files: [`evidence/${produced.file}`] });
    assert.strictEqual(result.review_mode, "task-review");
    const contextSidecar = verifySidecar(direct.context, result.context_file, { fresh: false });
    assert.strictEqual(contextSidecar.invocation.review_mode, "task-review");
    assert.strictEqual(contextSidecar.invocation.base_commit, git(direct.context.worktree, ["rev-parse", "HEAD"]));
    expectCode(() => createReviewContext(direct.context, { mode: "task-review", verification_files: [`evidence/${produced.file}`, `evidence/${produced.file}`] }), "MDF_REVIEW_EVIDENCE_PATH_INVALID");
    expectCode(() => createReviewContext(direct.context, { mode: "task-review", verification_files: ["evidence/interaction-001.json"] }), "MDF_REVIEW_EVIDENCE_PATH_INVALID");
    const decision = reviewDecision(direct.context, result, { disposition: "pass" });
    const evidenceBeforeStale = fs.readdirSync(path.join(direct.context.work_item.path, "evidence")).sort();
    write(path.join(direct.context.work_item.path, "verify.log"), "tampered\n");
    expectCode(() => registerReview(direct.context, { context_file: result.context_file, output_path: "report.md", decision_file: decision.decision_file, mode: "standalone" }), "MDF_REVIEW_INPUT_STALE");
    assert.deepStrictEqual(fs.readdirSync(path.join(direct.context.work_item.path, "evidence")).sort(), evidenceBeforeStale);
    write(path.join(direct.context.work_item.path, "verify.log"), "ok\n");
    const diffPath = path.join(direct.context.work_item.path, verifySidecar(direct.context, result.context_file, { fresh: false }).invocation.diff_path);
    const commandFile = verifySidecar(direct.context, result.context_file, { fresh: false }).invocation.verification_outputs[0].command_file;
    const commandPath = path.join(direct.context.work_item.path, "evidence", commandFile);
    const commandBytes = fs.readFileSync(commandPath);
    const evidenceBeforeCommandRemoval = fs.readdirSync(path.join(direct.context.work_item.path, "evidence")).sort();
    fs.unlinkSync(commandPath);
    expectCode(() => registerReview(direct.context, { context_file: result.context_file, output_path: "report.md", decision_file: decision.decision_file, mode: "standalone" }), "MDF_REVIEW_INPUT_STALE");
    assert.deepStrictEqual(fs.readdirSync(path.join(direct.context.work_item.path, "evidence")).sort(), evidenceBeforeCommandRemoval.filter((file) => file !== commandFile));
    write(commandPath, commandBytes);
    const evidenceBeforeDiffRemoval = fs.readdirSync(path.join(direct.context.work_item.path, "evidence")).sort();
    fs.unlinkSync(diffPath);
    expectCode(() => registerReview(direct.context, { context_file: result.context_file, output_path: "report.md", decision_file: decision.decision_file, mode: "standalone" }), "MDF_REVIEW_INPUT_STALE");
    assert.deepStrictEqual(fs.readdirSync(path.join(direct.context.work_item.path, "evidence")).sort(), evidenceBeforeDiffRemoval);
    write(diffPath, "");
    expectCode(() => registerReview(direct.context, { context_file: result.context_file, output_path: "report.md", decision_file: decision.decision_file, mode: "standalone", review_mode: "lifecycle-review" }), "MDF_REVIEW_EVIDENCE_MISMATCH");
    assert.strictEqual(registerReview(direct.context, { context_file: result.context_file, output_path: "report.md", decision_file: decision.decision_file, mode: "standalone" }).action, "stop");

    const nestedEvidence = path.join(direct.context.work_item.path, "evidence", "nested");
    fs.symlinkSync(direct.context.worktree, nestedEvidence, "dir");
    expectCode(() => verifySidecar(direct.context, "nested/missing.json", { fresh: false }), "MDF_EVIDENCE_SYMLINK");
    fs.unlinkSync(nestedEvidence);
  } finally {
    fs.rmSync(direct.temporaryRoot, { recursive: true, force: true });
  }

  const invalidBase = fixture();
  try {
    const produced = verification(invalidBase.context);
    git(invalidBase.context.worktree, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/heads/local"]);
    expectCode(() => createReviewContext(invalidBase.context, { mode: "task-review", verification_files: [`evidence/${produced.file}`] }), "MDF_REVIEW_BASE_INVALID");
  } finally {
    fs.rmSync(invalidBase.temporaryRoot, { recursive: true, force: true });
  }

  const lifecycle = fixture();
  try {
    verification(lifecycle.context);
    const nestedEvidence = path.join(lifecycle.context.work_item.path, "evidence", "nested");
    fs.mkdirSync(nestedEvidence, { recursive: true });
    write(path.join(nestedEvidence, "malformed.json"), "{}\n");
    const malformedInteraction = recordInteraction(lifecycle.context, { invocation: { agent_id: "caller-authored", invocation_id: "malformed-inputs", executor: "deterministic-runtime" }, input_paths: [] });
    const malformedValue = JSON.parse(fs.readFileSync(path.join(lifecycle.context.work_item.path, "evidence", malformedInteraction.file), "utf8"));
    malformedValue.inputs = [{ path: "evidence", sha256: "a".repeat(64), bytes: 1 }];
    malformedValue.git.head = "not-a-git-head";
    delete malformedValue.integrity_sha256;
    malformedValue.integrity_sha256 = crypto.createHash("sha256").update(JSON.stringify(malformedValue)).digest("hex");
    write(path.join(lifecycle.context.work_item.path, "evidence", malformedInteraction.file), `${JSON.stringify(malformedValue, null, 2)}\n`);
    expectCode(() => createReviewContext(lifecycle.context, { mode: "task-review", verification_files: ["evidence/verification-001.json"] }), "MDF_REVIEW_LIFECYCLE_EVIDENCE_PRESENT");
  } finally {
    fs.rmSync(lifecycle.temporaryRoot, { recursive: true, force: true });
  }

  const producer = fixture();
  try {
    const invalid = verification(producer.context, "caller-authored");
    expectCode(() => createReviewContext(producer.context, { mode: "task-review", verification_files: [`evidence/${invalid.file}`] }), "MDF_REVIEW_PRODUCER_INVALID");
  } finally {
    fs.rmSync(producer.temporaryRoot, { recursive: true, force: true });
  }

  const build = fixture();
  try {
    build.context.lock = { task_id: "0036", work_id: build.context.work_item.id, branch: "main" };
    const attempt = recordInteraction(build.context, { invocation: { agent_id: "mdf-build-task-select", invocation_id: "direct-attempt", executor: "deterministic-runtime", task: { id: "T2" }, base_head: git(build.context.worktree, ["rev-parse", "HEAD"]) }, input_paths: [] });
    const standard = runVerification(build.context, { attempt_file: attempt.file, command: [process.execPath, "-e", "process.exit(0)"], output_path: "build-command.log" });
    assert.match(standard.verification_file, /^verification-\d{3}\.json$/);
    assert.strictEqual(verifySidecar(build.context, standard.verification_file, { fresh: false }).invocation.agent_id, "mdf-build-verification");
    const result = runVerification(build.context, { attempt_file: attempt.file, producer: "mdf-direct-verification", command: [process.execPath, "-e", "process.exit(0)"], output_path: "direct-command.log" });
    assert.match(result.verification_file, /^verification-\d{3}\.json$/);
    assert.strictEqual(verifySidecar(build.context, result.verification_file, { fresh: false }).invocation.agent_id, "mdf-direct-verification");
  } finally {
    fs.rmSync(build.temporaryRoot, { recursive: true, force: true });
  }

  const routed = resolverFixture();
  try {
    const produced = verification(routed.context);
    const request = { mode: "task-review", verification_files: [`evidence/${produced.file}`] };
    const contextCli = spawnSync(process.execPath, [cliPath, "review", "context", "--cwd", routed.worktree, "--plugin-root", root], { encoding: "utf8", input: JSON.stringify(request) });
    assert.strictEqual(contextCli.status, 0, contextCli.stderr);
    const reviewContext = JSON.parse(contextCli.stdout).review;
    assert.strictEqual(reviewContext.review_mode, "task-review");
    const decision = reviewDecision(routed.context, reviewContext, { disposition: "pass" });
    const registerCli = spawnSync(process.execPath, [cliPath, "review", "register", "--cwd", routed.worktree, "--plugin-root", root], { encoding: "utf8", input: JSON.stringify({ context_file: reviewContext.context_file, output_path: "report.md", decision_file: decision.decision_file, mode: "standalone" }) });
    assert.strictEqual(registerCli.status, 0, registerCli.stderr);
    assert.strictEqual(JSON.parse(registerCli.stdout).review.action, "stop");
  } finally {
    fs.rmSync(routed.temporaryRoot, { recursive: true, force: true });
  }

  const active = resolverFixture({ active: true });
  try {
    const produced = verification(active.context);
    const contextCli = spawnSync(process.execPath, [cliPath, "review", "context", "--cwd", active.worktree, "--plugin-root", root], { encoding: "utf8", input: JSON.stringify({ mode: "task-review", verification_files: [`evidence/${produced.file}`] }) });
    assert.strictEqual(contextCli.status, 0, contextCli.stderr);
    const reviewContext = JSON.parse(contextCli.stdout).review;
    const decision = reviewDecision(active.context, reviewContext, { disposition: "pass" });
    const evidenceBeforeLockStale = fs.readdirSync(path.join(active.context.work_item.path, "evidence")).sort();
    const lockBytes = fs.readFileSync(active.lockPath);
    const lock = JSON.parse(lockBytes);
    lock.runtime = "changed-runtime";
    write(active.lockPath, JSON.stringify(lock, null, 2));
    const registerCli = spawnSync(process.execPath, [cliPath, "review", "register", "--cwd", active.worktree, "--plugin-root", root], { encoding: "utf8", input: JSON.stringify({ context_file: reviewContext.context_file, output_path: "report.md", decision_file: decision.decision_file, mode: "standalone" }) });
    assert.strictEqual(registerCli.status, 1);
    assert.strictEqual(JSON.parse(registerCli.stderr).error.code, "MDF_REVIEW_INPUT_STALE");
    assert.deepStrictEqual(fs.readdirSync(path.join(active.context.work_item.path, "evidence")).sort(), evidenceBeforeLockStale);
    write(active.lockPath, lockBytes);

    const registerActive = () => registerReview(active.context, { context_file: reviewContext.context_file, output_path: "report.md", decision_file: decision.decision_file, mode: "standalone" });
    const evidenceBeforeMissingLock = fs.readdirSync(path.join(active.context.work_item.path, "evidence")).sort();
    fs.unlinkSync(active.lockPath);
    expectCode(registerActive, "MDF_REVIEW_INPUT_STALE");
    assert.deepStrictEqual(fs.readdirSync(path.join(active.context.work_item.path, "evidence")).sort(), evidenceBeforeMissingLock);
    write(active.lockPath, lockBytes);

    const cardPath = active.context.task.item_path;
    const cardBytes = fs.readFileSync(cardPath);
    const evidenceBeforeMissingCard = fs.readdirSync(path.join(active.context.work_item.path, "evidence")).sort();
    fs.unlinkSync(cardPath);
    expectCode(registerActive, "MDF_REVIEW_INPUT_STALE");
    assert.deepStrictEqual(fs.readdirSync(path.join(active.context.work_item.path, "evidence")).sort(), evidenceBeforeMissingCard);
    write(cardPath, cardBytes);

    const markerPath = path.join(active.context.canonical_root, ".mdf", "project", "init.json");
    const markerBytes = fs.readFileSync(markerPath);
    const evidenceBeforeMissingMarker = fs.readdirSync(path.join(active.context.work_item.path, "evidence")).sort();
    fs.unlinkSync(markerPath);
    expectCode(registerActive, "MDF_REVIEW_INPUT_STALE");
    assert.deepStrictEqual(fs.readdirSync(path.join(active.context.work_item.path, "evidence")).sort(), evidenceBeforeMissingMarker);
    write(markerPath, markerBytes);
  } finally {
    fs.rmSync(active.temporaryRoot, { recursive: true, force: true });
  }
}

try {
  runTests();
  console.log("MDF review registration validation passed");
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
