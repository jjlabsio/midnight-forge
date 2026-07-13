#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { resolveReviewControllerContext, resolveControllerContext } = require("./controller-runtime/context");
const { recordInteraction } = require("./controller-runtime/evidence");
const { issueAction, issueCapability, prepareAdapter, submitOutcome } = require("./controller-runtime/adapter");

const root = path.resolve(__dirname, "..");
const cliPath = path.join(root, "scripts", "mdf-controller.js");

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function runGit(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function createFixture({ status = "done", completed = null, lock = true, branch = "codex/task-0036", itemBranch = branch, itemWorktree = null, extraFrontmatter = "" } = {}) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdf-review-context-"));
  const canonicalRoot = path.join(temporaryRoot, "project");
  const worktree = path.join(canonicalRoot, ".worktrees", "task-0036");
  const workId = "2026-07-12-0036-review-context";
  const workItem = path.join(canonicalRoot, ".mdf", "work", workId);
  fs.mkdirSync(worktree, { recursive: true });
  const resolvedCanonicalRoot = fs.realpathSync(canonicalRoot);
  const resolvedWorktree = fs.realpathSync(worktree);
  writeJson(path.join(canonicalRoot, ".mdf", "project", "init.json"), { version: 1 });
  writeJson(path.join(canonicalRoot, ".mdf", "project.json"), { version: 1 });
  fs.mkdirSync(path.join(canonicalRoot, ".mdf", "locks"), { recursive: true });
  fs.mkdirSync(workItem, { recursive: true });
  fs.writeFileSync(path.join(canonicalRoot, ".mdf", "index.jsonl"), "");
  const completion = completed === null ? "" : `completed: \"${completed}\"\n`;
  fs.writeFileSync(path.join(workItem, "item.md"), `---
work_id: \"${workId}\"
task_id: \"0036\"
kind: \"task\"
title: \"Review context\"
order: 1
status: \"${status}\"
created: \"2026-07-12\"
${completion}worktree: \"${itemWorktree || resolvedWorktree}\"
branch: \"${itemBranch}\"
latest: {}
${extraFrontmatter}---
`);
  runGit(worktree, ["init", "--quiet"]);
  runGit(worktree, ["config", "user.email", "test@example.com"]);
  runGit(worktree, ["config", "user.name", "MDF test"]);
  fs.writeFileSync(path.join(worktree, "tracked.txt"), "fixture\n");
  runGit(worktree, ["add", "tracked.txt"]);
  runGit(worktree, ["commit", "--quiet", "-m", "fixture"]);
  runGit(worktree, ["branch", "-m", branch]);
  if (lock) {
    writeJson(path.join(canonicalRoot, ".mdf", "locks", "0036.lock"), {
      task_id: "0036",
      work_id: workId,
      canonical_root: resolvedCanonicalRoot,
      worktree: resolvedWorktree,
      branch,
      started: "2026-07-12T00:00:00.000Z",
      runtime: "test",
    });
  }
  return { temporaryRoot, canonicalRoot: resolvedCanonicalRoot, worktree: resolvedWorktree, workItem, workId, branch };
}

function expectCode(callback, code) {
  assert.throws(callback, (error) => error && error.code === code, `expected ${code}`);
}

function captureCode(callback, code) {
  try {
    callback();
  } catch (error) {
    assert.strictEqual(error.code, code, `expected ${code}, got ${error.code}`);
    return error;
  }
  assert.fail(`expected ${code}`);
}

function runCli(fixture, command, input = {}) {
  return spawnSync(process.execPath, [cliPath, ...command, "--cwd", fixture.worktree, "--plugin-root", root], {
    cwd: fixture.worktree,
    encoding: "utf8",
    input: JSON.stringify(input),
  });
}

function runTests() {
  const dispatcherSource = fs.readFileSync(cliPath, "utf8");
  assert.match(dispatcherSource, /createReviewContext\(context, request\)/, "review context must receive the parsed request");

  const completed = createFixture({ lock: false, completed: "2026-07-13" });
  try {
    const context = resolveReviewControllerContext({ cwd: completed.worktree, pluginRoot: root });
    assert.strictEqual(context.task.task_id, "0036");
    assert.strictEqual(context.task.status, "done");
    assert.strictEqual(context.worktree, fs.realpathSync(completed.worktree));
    assert.strictEqual(context.lock, null);
    const reviewRegister = runCli(completed, ["review", "register"]);
    assert.strictEqual(reviewRegister.status, 1);
    assert.notStrictEqual(JSON.parse(reviewRegister.stderr).error.code, "MDF_ACTIVE_LOCK_MISSING");
    const reviewContext = recordInteraction(context, {
      invocation: { agent_id: "mdf-review-context", invocation_id: "route-context", executor: "deterministic-runtime" },
      input_paths: [],
    });
    const outputPath = "routed-review.md";
    fs.writeFileSync(path.join(context.work_item.path, outputPath), "pass\n");
    fs.writeFileSync(path.join(context.work_item.path, "route-capability.json"), "{}\n");
    const action = issueAction(context, {
      action_id: "route-review",
      action: "standalone-review",
      skill_path: "skills/code-review-and-quality/SKILL.md",
      persona_path: "agents/code-reviewer.md",
      input_paths: [`evidence/${reviewContext.file}`],
    });
    const invocation = {
      agent_id: "route-reviewer",
      invocation_id: "route-review-inv",
      executor: "subagent",
      model_capability: "independent-review-capable",
      freshness: "fresh",
      capability: { persona_loaded: true, reasoning_capable: true, model_suitable: true, fresh_context: true, source: "runtime-verified" },
    };
    const capability = issueCapability(context, { ...invocation, persona_path: "agents/code-reviewer.md", evidence_path: "route-capability.json" });
    const prepared = prepareAdapter(context, { action_file: action.action_file, capability_file: capability.capability_file, invocation });
    const submitted = submitOutcome(context, { action_id: action.action_id, interaction_file: prepared.interaction_file, output_path: outputPath, outcome: { disposition: "pass", human_required: false } });
    const routed = runCli(completed, ["review", "register"], {
      context_file: reviewContext.file,
      output_path: outputPath,
      decision_file: submitted.decision_file,
      mode: "standalone",
    });
    assert.strictEqual(routed.status, 0, routed.stderr);
    assert.strictEqual(JSON.parse(routed.stdout).review.action, "stop");
  } finally {
    fs.rmSync(completed.temporaryRoot, { recursive: true, force: true });
  }

  const active = createFixture({ status: "active", completed: null, lock: true });
  try {
    const context = resolveReviewControllerContext({ cwd: active.worktree, pluginRoot: root });
    assert.strictEqual(context.lock.task_id, "0036");
    assert.strictEqual(context.lock.work_id, active.workId);
    assert.strictEqual(context.lock.branch, active.branch);
  } finally {
    fs.rmSync(active.temporaryRoot, { recursive: true, force: true });
  }

  const lockMismatch = createFixture({ status: "active", completed: null, lock: true });
  try {
    const lockPath = path.join(lockMismatch.canonicalRoot, ".mdf", "locks", "0036.lock");
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    lock.branch = "codex/other";
    writeJson(lockPath, lock);
    expectCode(() => resolveReviewControllerContext({ cwd: lockMismatch.worktree, pluginRoot: root }), "MDF_REVIEW_LOCK_MISMATCH");
  } finally {
    fs.rmSync(lockMismatch.temporaryRoot, { recursive: true, force: true });
  }

  const malformedLock = createFixture({ status: "active", completed: null, lock: true });
  try {
    const lockPath = path.join(malformedLock.canonicalRoot, ".mdf", "locks", "0036.lock");
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    const fields = Object.entries(lock).map(([key, value]) => `\"${key}\":${JSON.stringify(value)}`);
    fields.push(`\"task_id\":\"0036\"`);
    fs.writeFileSync(lockPath, `{${fields.join(",")}}`);
    expectCode(() => resolveReviewControllerContext({ cwd: malformedLock.worktree, pluginRoot: root }), "MDF_REVIEW_LOCK_MALFORMED");
  } finally {
    fs.rmSync(malformedLock.temporaryRoot, { recursive: true, force: true });
  }

  const nonCanonicalCardPath = createFixture({ lock: false, completed: "2026-07-13", itemWorktree: null });
  try {
    const itemPath = path.join(nonCanonicalCardPath.workItem, "item.md");
    const nonCanonical = `${nonCanonicalCardPath.worktree}/../task-0036`;
    fs.writeFileSync(itemPath, fs.readFileSync(itemPath, "utf8").replace(nonCanonicalCardPath.worktree, nonCanonical));
    expectCode(() => resolveReviewControllerContext({ cwd: nonCanonicalCardPath.worktree, pluginRoot: root }), "MDF_REVIEW_TASK_METADATA_INVALID");
  } finally {
    fs.rmSync(nonCanonicalCardPath.temporaryRoot, { recursive: true, force: true });
  }

  const nonCanonicalLockPath = createFixture({ status: "active", completed: null, lock: true });
  try {
    const lockPath = path.join(nonCanonicalLockPath.canonicalRoot, ".mdf", "locks", "0036.lock");
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    lock.worktree = `${nonCanonicalLockPath.worktree}/../task-0036`;
    writeJson(lockPath, lock);
    expectCode(() => resolveReviewControllerContext({ cwd: nonCanonicalLockPath.worktree, pluginRoot: root }), "MDF_REVIEW_LOCK_MALFORMED");
  } finally {
    fs.rmSync(nonCanonicalLockPath.temporaryRoot, { recursive: true, force: true });
  }

  const completedWithLock = createFixture({ lock: true, completed: "2026-07-13" });
  try {
    const itemBefore = fs.readFileSync(path.join(completedWithLock.workItem, "item.md"), "utf8");
    const lockBefore = fs.readFileSync(path.join(completedWithLock.canonicalRoot, ".mdf", "locks", "0036.lock"), "utf8");
    expectCode(() => resolveReviewControllerContext({ cwd: completedWithLock.worktree, pluginRoot: root }), "MDF_REVIEW_TASK_STATE_INVALID");
    assert.strictEqual(fs.readFileSync(path.join(completedWithLock.workItem, "item.md"), "utf8"), itemBefore);
    assert.strictEqual(fs.readFileSync(path.join(completedWithLock.canonicalRoot, ".mdf", "locks", "0036.lock"), "utf8"), lockBefore);
  } finally {
    fs.rmSync(completedWithLock.temporaryRoot, { recursive: true, force: true });
  }

  const missingLock = createFixture({ status: "active", lock: false });
  try {
    expectCode(() => resolveReviewControllerContext({ cwd: missingLock.worktree, pluginRoot: root }), "MDF_REVIEW_LOCK_MISSING");
  } finally {
    fs.rmSync(missingLock.temporaryRoot, { recursive: true, force: true });
  }

  const branchMismatch = createFixture({ lock: false, completed: "2026-07-13", itemBranch: "codex/other" });
  try {
    const error = captureCode(() => resolveReviewControllerContext({ cwd: branchMismatch.worktree, pluginRoot: root }), "MDF_REVIEW_BRANCH_MISMATCH");
    assert.strictEqual(error.details.expected, branchMismatch.branch);
    assert.strictEqual(error.details.actual, "codex/other");
  } finally {
    fs.rmSync(branchMismatch.temporaryRoot, { recursive: true, force: true });
  }

  const worktreeMismatch = createFixture({ lock: false, completed: "2026-07-13" });
  try {
    const otherWorktree = path.join(worktreeMismatch.canonicalRoot, ".worktrees", "other");
    fs.mkdirSync(otherWorktree, { recursive: true });
    const itemPath = path.join(worktreeMismatch.workItem, "item.md");
    const current = fs.readFileSync(itemPath, "utf8");
    fs.writeFileSync(itemPath, current.replace(fs.realpathSync(worktreeMismatch.worktree), fs.realpathSync(otherWorktree)));
    expectCode(() => resolveReviewControllerContext({ cwd: worktreeMismatch.worktree, pluginRoot: root }), "MDF_REVIEW_WORKTREE_MISMATCH");
  } finally {
    fs.rmSync(worktreeMismatch.temporaryRoot, { recursive: true, force: true });
  }

  const detached = createFixture({ lock: false, completed: "2026-07-13" });
  try {
    runGit(detached.worktree, ["checkout", "--detach", "--quiet"]);
    expectCode(() => resolveReviewControllerContext({ cwd: detached.worktree, pluginRoot: root }), "MDF_REVIEW_BRANCH_MISMATCH");
  } finally {
    fs.rmSync(detached.temporaryRoot, { recursive: true, force: true });
  }

  const queued = createFixture({ status: "queue", lock: false, completed: null });
  try {
    expectCode(() => resolveReviewControllerContext({ cwd: queued.worktree, pluginRoot: root }), "MDF_REVIEW_TASK_NOT_ACTIVE_OR_COMPLETED");
  } finally {
    fs.rmSync(queued.temporaryRoot, { recursive: true, force: true });
  }

  const malformed = createFixture({ lock: false, completed: "2026-07-13", extraFrontmatter: "unknown: \"nope\"\n" });
  try {
    expectCode(() => resolveReviewControllerContext({ cwd: malformed.worktree, pluginRoot: root }), "MDF_REVIEW_TASK_METADATA_INVALID");
  } finally {
    fs.rmSync(malformed.temporaryRoot, { recursive: true, force: true });
  }

  const symlinkedItem = createFixture({ lock: false, completed: "2026-07-13" });
  try {
    fs.symlinkSync(symlinkedItem.workItem, path.join(symlinkedItem.canonicalRoot, ".mdf", "work", "2026-07-13-9999-link"), "dir");
    expectCode(() => resolveReviewControllerContext({ cwd: symlinkedItem.worktree, pluginRoot: root }), "MDF_REVIEW_TASK_METADATA_INVALID");
  } finally {
    fs.rmSync(symlinkedItem.temporaryRoot, { recursive: true, force: true });
  }

  const strict = createFixture({ lock: false, completed: "2026-07-13" });
  try {
    const response = runCli(strict, ["context"]);
    assert.strictEqual(response.status, 1);
    assert.strictEqual(JSON.parse(response.stderr).error.code, "MDF_ACTIVE_LOCK_MISSING");
    const strictRoutes = [
      ["context"], ["lifecycle", "next"], ["lifecycle", "resume"],
      ["spec", "register"], ["spec", "approve"], ["spec", "advance"],
      ["plan", "metadata"], ["plan", "register"], ["plan", "approve"], ["plan", "advance"],
      ["build-task", "select"], ["build-task", "repair"], ["build-task", "verify"], ["build-task", "impact"], ["build-task", "authorize"], ["build-task", "complete"],
      ["whole-build", "resume"], ["whole-build", "begin"], ["whole-build", "verify"], ["whole-build", "inputs"], ["whole-build", "finalize"],
      ["simplify", "scope"], ["simplify", "register"], ["simplify", "select"], ["simplify", "reject"], ["simplify", "rejected"], ["simplify", "no-change"],
      ["ship", "context"], ["ship", "risk"], ["ship", "register"],
      ["github-pr", "authorize"], ["github-pr", "observe"], ["github-pr", "handoff"],
      ["recovery"], ["recovery", "whole-build"], ["recovery", "plan"], ["technical-revision"],
      ["adapter", "issue"], ["adapter", "capability"], ["adapter", "prepare"], ["adapter", "submit"],
    ];
    for (const route of strictRoutes) {
      const routeResponse = runCli(strict, route);
      assert.strictEqual(routeResponse.status, 1, route.join(" "));
      const routeCode = JSON.parse(routeResponse.stderr).error.code;
      assert.strictEqual(routeCode, "MDF_ACTIVE_LOCK_MISSING", `${route.join(" ")} returned ${routeCode}`);
    }
    const unsupported = runCli(strict, ["review", "context", "--task-review"]);
    assert.strictEqual(unsupported.status, 1);
    assert.strictEqual(JSON.parse(unsupported.stderr).error.code, "MDF_CONTROLLER_USAGE");
  } finally {
    fs.rmSync(strict.temporaryRoot, { recursive: true, force: true });
  }

  const collision = createFixture({ lock: false, completed: "2026-07-13" });
  try {
    const secondItem = path.join(collision.canonicalRoot, ".mdf", "work", "2026-07-13-9999-other", "item.md");
    fs.mkdirSync(path.dirname(secondItem), { recursive: true });
    fs.writeFileSync(secondItem, fs.readFileSync(path.join(collision.workItem, "item.md"), "utf8").replace(collision.workId, "2026-07-13-9999-other").replace("task_id: \"0036\"", "task_id: \"9999\""));
    expectCode(() => resolveReviewControllerContext({ cwd: collision.worktree, pluginRoot: root }), "MDF_REVIEW_CONTEXT_AMBIGUOUS");
  } finally {
    fs.rmSync(collision.temporaryRoot, { recursive: true, force: true });
  }

  for (const collisionField of ["branch", "worktree"]) {
    const fieldCollision = createFixture({ lock: false, completed: "2026-07-13" });
    try {
      const otherWorktree = path.join(fieldCollision.canonicalRoot, ".worktrees", `other-${collisionField}`);
      fs.mkdirSync(otherWorktree, { recursive: true });
      const otherDirectory = path.join(fieldCollision.canonicalRoot, ".mdf", "work", `2026-07-13-9999-${collisionField}`);
      fs.mkdirSync(otherDirectory, { recursive: true });
      let duplicateItem = fs.readFileSync(path.join(fieldCollision.workItem, "item.md"), "utf8")
        .replace(fieldCollision.workId, `2026-07-13-9999-${collisionField}`)
        .replace("task_id: \"0036\"", "task_id: \"9999\"");
      if (collisionField === "branch") duplicateItem = duplicateItem.replace(fs.realpathSync(fieldCollision.worktree), fs.realpathSync(otherWorktree));
      else duplicateItem = duplicateItem.replace(`branch: \"${fieldCollision.branch}\"`, "branch: \"codex/other\"");
      fs.writeFileSync(path.join(otherDirectory, "item.md"), duplicateItem);
      const error = captureCode(() => resolveReviewControllerContext({ cwd: fieldCollision.worktree, pluginRoot: root }), "MDF_REVIEW_CONTEXT_AMBIGUOUS");
      assert.strictEqual(error.details.field, collisionField);
      assert(Array.isArray(error.details.candidates) && error.details.candidates.length === 2);
    } finally {
      fs.rmSync(fieldCollision.temporaryRoot, { recursive: true, force: true });
    }
  }

  const duplicateIdentity = createFixture({ lock: false, completed: "2026-07-13" });
  try {
    const otherDirectory = path.join(duplicateIdentity.canonicalRoot, ".worktrees", "other");
    fs.mkdirSync(otherDirectory, { recursive: true });
    const otherItemDirectory = path.join(duplicateIdentity.canonicalRoot, ".mdf", "work", "2026-07-13-9999-duplicate");
    fs.mkdirSync(otherItemDirectory, { recursive: true });
    const duplicateItem = fs.readFileSync(path.join(duplicateIdentity.workItem, "item.md"), "utf8")
      .replace(duplicateIdentity.workId, "2026-07-13-9999-duplicate")
      .replace(fs.realpathSync(duplicateIdentity.worktree), fs.realpathSync(otherDirectory))
      .replace(`branch: \"${duplicateIdentity.branch}\"`, "branch: \"codex/other\"");
    fs.writeFileSync(path.join(otherItemDirectory, "item.md"), duplicateItem);
    expectCode(() => resolveReviewControllerContext({ cwd: duplicateIdentity.worktree, pluginRoot: root }), "MDF_REVIEW_CONTEXT_AMBIGUOUS");
  } finally {
    fs.rmSync(duplicateIdentity.temporaryRoot, { recursive: true, force: true });
  }
}

try {
  runTests();
  console.log("MDF review context validation passed");
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
